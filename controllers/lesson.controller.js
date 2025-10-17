'use strict';

const Lesson = require('../models/lesson.model');
const Comment = require('../models/comment.model');
const User = require('../models/user.model');
const KnowledgeArea = require('../models/knowledge-area.model');
const Notification = require('../models/notification.model');
const moment = require('moment');
const LESSON_PATH = './uploads/lessons/';

const mail = require('../services/mail.service');
const fs = require('fs').promises; // Use promise-based version of fs
const path = require('path');
const { ITEMS_PER_PAGE } = require('../config.json');
const NotificationService = require('../services/notification.service');

// Simplify error handling with a middleware-like approach
const handleError = (res, message = 'Request failed', statusCode = 500) => {
    return res.status(statusCode).send({ message });
};
const sendPaginatedResponse = (res, data) => {
    if (!data || !data.docs || data.docs.length === 0) {
        return res.status(200).send({
            message: 'No lessons found',
            lessons: [],
            total: 0,
            pages: 0,
            currentPage: data.page || 1
        });
    }
    return res.status(200).send({
        lessons: data.docs,
        total: data.totalDocs,
        pages: data.totalPages,
        currentPage: data.page
    });
};

const saveLesson = async (req, res) => {
    const { body: params } = req;
    const lesson = new Lesson(params);
    lesson.created_at = moment().unix();
    
    try {
        const lessonStored = await lesson.save();
        
        // Obtener información del usuario que sugiere la lección
        const suggestionAuthor = await User.findById(req.user.sub);
        
        // Si es una sugerencia de lección, enviar notificaciones
        if (params.class === 'suggest' || lesson.state === 'proposed') {
            try {
                // 1. Notificar al usuario que sugiere
                await NotificationService.createLessonSuggestionSubmittedNotification(
                    suggestionAuthor._id,
                    lessonStored._id,
                    lessonStored.title
                );

                // 2. Notificar a administradores y gestores de lecciones sobre nueva sugerencia
                await NotificationService.createNewTaskNotificationForManagers(
                    'new_suggestion',
                    { lessonTitle: lessonStored.title },
                    suggestionAuthor
                );

                // 4. Si hay un facilitador sugerido, notificarle
                if (lessonStored.suggested_facilitator) {
                    await NotificationService.createFacilitatorSuggestionNotification(
                        suggestionAuthor,
                        lessonStored.suggested_facilitator,
                        lessonStored._id,
                        lessonStored.title
                    );
                }

                console.log('Notificaciones de sugerencia de lección enviadas correctamente');
            } catch (notificationError) {
                console.error('Error enviando notificaciones de sugerencia:', notificationError);
                // No fallar la operación principal por errores de notificación
            }
        }

        // Si es una experiencia, enviar notificaciones específicas
        if (params.class === 'experience') {
            try {
                // 1. Notificar al usuario que envía la experiencia
                await NotificationService.createExperienceSubmittedNotification(
                    suggestionAuthor._id,
                    lessonStored._id,
                    lessonStored.title
                );

                // 2. Obtener administradores y administradores delegados
                const adminUsers = await User.find({
                    $or: [
                        { role: 'admin' },
                        { role: 'delegated_admin' }
                    ]
                }).select('_id');

                const adminIds = adminUsers.map(admin => admin._id);

                // 3. Notificar a administradores sobre nueva experiencia
                if (adminIds.length > 0) {
                    await NotificationService.createNewExperiencePendingNotification(
                        suggestionAuthor,
                        lessonStored._id,
                        lessonStored.title,
                        lessonStored.type || 'No especificado',
                        adminIds
                    );
                }

                // 4. Si es tipo "Desarrollo" y hay un facilitador sugerido, notificarle
                if (lessonStored.type === 'Desarrollo' && lessonStored.suggested_facilitator) {
                    await NotificationService.createExperienceFacilitatorSuggestionNotification(
                        suggestionAuthor,
                        lessonStored.suggested_facilitator,
                        lessonStored._id,
                        lessonStored.title
                    );
                }

                console.log('Notificaciones de experiencia enviadas correctamente');
            } catch (notificationError) {
                console.error('Error enviando notificaciones de experiencia:', notificationError);
                // No fallar la operación principal por errores de notificación
            }
        }

        // Enviar email 
        const emailSubject = params.class === 'suggest' ? 'Nueva sugerencia de lección' : 'Nueva experencia registrada';
        const emailBody = `<h3>Hola</h3><p>Se ha registrado una ${params.class === 'suggest' ? 'sugerencia' : 'experiencia'} con el título:</p><p><strong>"${lessonStored.title}"</strong></p><p>Ingresa al panel de administración para revisar la información de la nueva propuesta.</p>`;

        mail.sendMail(emailSubject, process.env.EMAIL, emailBody);

        return res.status(200).send({ lesson: lessonStored });
    } catch (err) {
        console.error('Error saving lesson:', err);
        return handleError(res, 'Error in the request. The lesson cannot be saved');
    }
};

const uploadLessonFiles = async (req, res) => {
    if (req.files) {
        return res.status(200).send({ message: 'The files were uploaded correctly' });
    }
    return handleError(res, 'No files uploaded', 400);
};

const getLessonFile = async (req, res) => {
    const { file } = req.params;
    const pathFile = path.resolve(LESSON_PATH, file);

    try {
        await fs.access(pathFile);
        return res.sendFile(pathFile);
    } catch (err) {
        const message = err.code === 'ENOENT' ? 'The file does not exist' : 'Error requesting the file.';
        return handleError(res, message, err.code === 'ENOENT' ? 404 : 500);
    }
};

const deleteLesson = async (req, res) => {
    const lessonId = req.params.id;

    try {
        const lessonRemoved = await Lesson.findByIdAndDelete(lessonId);
        if (!lessonRemoved) {
            return handleError(res, 'Lesson not found', 404);
        }
        
        // Si la lección eliminada tiene versión > 1, limpiar son_lesson del padre
        if (lessonRemoved.version && lessonRemoved.version > 1 && lessonRemoved.father_lesson) {
            console.log(`Limpiando son_lesson del padre (${lessonRemoved.father_lesson}) porque se eliminó versión ${lessonRemoved.version}`);
            await Lesson.findByIdAndUpdate(
                lessonRemoved.father_lesson,
                { $unset: { son_lesson: "" } }
            );
        }
        
        await Comment.deleteMany({ _id: { $in: lessonRemoved.comments } });
        return res.status(200).send({ lesson: lessonRemoved });
    } catch (err) {
        console.log(err);
        return handleError(res);
    }
};


const updateLesson = async (req, res) => {
    const { id: lessonId } = req.params;
    const updateData = { ...req.body };

    // Si req.body.call existe, desglosar sus propiedades individualmente para evitar el conflicto
    if (req.body.call) {
        for (const key in req.body.call) {
            updateData[`call.${key}`] = req.body.call[key];
        }
        delete updateData.call; // Eliminar el objeto call del updateData para evitar el conflicto
    }

    console.log("Incoming Request: PUT /api/lesson/:id");
    console.log("Lesson ID:", lessonId);
    console.log("Update Data:", JSON.stringify(updateData, null, 2));  // Log más detallado

    try {
        // Validar que lessonId sea un ObjectId válido
        if (!lessonId || !lessonId.match(/^[0-9a-fA-F]{24}$/)) {
            console.error("Invalid lesson ID format:", lessonId);
            return res.status(400).send({ message: 'Invalid lesson ID format' });
        }

        // Obtener la lección actual para comparar estados
        const currentLesson = await Lesson.findById(lessonId).populate('author');
        if (!currentLesson) {
            console.log("Lesson not found with ID:", lessonId);
            return res.status(404).send({ message: 'Lesson not found' });
        }

        console.log("Current lesson found:", {
            id: currentLesson._id,
            title: currentLesson.title,
            state: currentLesson.state,
            level: currentLesson.level
        });

        // Validaciones específicas de datos
        console.log("Validating update data...");

        // Validar level si existe
        if (updateData.level !== undefined) {
            if (!Array.isArray(updateData.level)) {
                console.error("Level should be an array, received:", typeof updateData.level, updateData.level);
                return res.status(400).send({ message: 'Level must be an array' });
            }
            console.log("Level validation passed:", updateData.level);
        }

        // Validar knowledge_area si existe
        if (updateData.knowledge_area !== undefined) {
            if (!Array.isArray(updateData.knowledge_area)) {
                console.error("Knowledge_area should be an array, received:", typeof updateData.knowledge_area, updateData.knowledge_area);
                return res.status(400).send({ message: 'Knowledge_area must be an array' });
            }
            console.log("Knowledge_area validation passed:", updateData.knowledge_area);
        }

        // Validar state si existe
        if (updateData.state !== undefined) {
            console.log("State update detected:", {
                currentState: currentLesson.state,
                newState: updateData.state
            });
        }       
        // Log de campos específicos que se están actualizando
        console.log("Fields being updated:", {
            hasLevel: updateData.level !== undefined,
            hasKnowledgeArea: updateData.knowledge_area !== undefined,
            hasState: updateData.state !== undefined,
            hasTitle: updateData.title !== undefined
        });

        // Validar campos de texto
        if (updateData.title !== undefined && (!updateData.title || updateData.title.trim().length === 0)) {
            console.error("Title is required and cannot be empty");
            return res.status(400).send({ message: 'Title is required' });
        }

        if (updateData.resume !== undefined && (!updateData.resume || updateData.resume.trim().length === 0)) {
            console.error("Resume is required and cannot be empty");
            return res.status(400).send({ message: 'Resume is required' });
        }

        // Validar y limpiar duplicados en development_group si existe
        if (updateData.development_group && Array.isArray(updateData.development_group)) {
            // Eliminar duplicados basándose en _id
            const uniqueMembers = [];
            const seenIds = new Set();
            
            for (const member of updateData.development_group) {
                const memberId = member._id || member;
                if (!seenIds.has(memberId.toString())) {
                    seenIds.add(memberId.toString());
                    uniqueMembers.push(member);
                }
            }
            
            updateData.development_group = uniqueMembers;
            console.log(`Duplicados eliminados en development_group. Miembros únicos: ${uniqueMembers.length}`);
        }

        console.log("Attempting to update lesson in database...");
        
        let lessonUpdated;
        try {
            lessonUpdated = await Lesson.findByIdAndUpdate(lessonId, updateData, { new: true });
            console.log("Lesson updated in database successfully");
            
            // Verificar qué campos se actualizaron realmente
            console.log("Updated lesson fields:", {
                id: lessonUpdated._id,
                state: lessonUpdated.state,
                level: lessonUpdated.level,
                knowledge_area: lessonUpdated.knowledge_area,
                title: lessonUpdated.title
            });
        } catch (updateError) {
            console.error("Error updating lesson in database:", updateError);
            throw updateError;
        }

        // Populate después de la actualización para evitar errores
        try {
            console.log("Attempting to populate lesson data...");
            lessonUpdated = await Lesson.findById(lessonId)
                .populate(populateLesson())
                .populate({
                    path: 'comments',
                    populate: { path: 'user', select: 'name surname picture role _id' }
                });
            console.log("Lesson populated successfully");
        } catch (populateError) {
            console.error("Error populating lesson, using basic data:", populateError);
            // Si falla el populate, usar la lección sin populate
            lessonUpdated = await Lesson.findById(lessonId);
        }

        // Enviar notificaciones cuando la lección pasa a 'assigned' (asignación desde Admin)
        try {
            const stateChangedToAssigned = updateData.state === 'assigned' && currentLesson.state !== 'assigned';
            if (stateChangedToAssigned) {
                // Cargar usuarios necesarios
                const adminUser = await User.findById(req.user.sub).select('name surname _id');

                const leaderId = (updateData.leader && updateData.leader._id) ? updateData.leader._id : updateData.leader;
                const expertId = (updateData.expert && updateData.expert._id) ? updateData.expert._id : updateData.expert;
                let developmentGroupIds = [];
                if (Array.isArray(updateData.development_group)) {
                    developmentGroupIds = updateData.development_group.map(m => (m && m._id) ? m._id : m).filter(Boolean);
                } else if (Array.isArray(lessonUpdated.development_group)) {
                    developmentGroupIds = lessonUpdated.development_group.map(m => (m && m._id) ? m._id : m).filter(Boolean);
                }

                // Notificar a líder
                if (leaderId) {
                    await NotificationService.createLeaderAssignmentNotification(
                        adminUser,
                        leaderId,
                        lessonUpdated._id,
                        lessonUpdated.title
                    ).catch(err => console.error('Error notifying leader assignment:', err));
                }

                // Notificar a facilitador (experto)
                if (expertId) {
                    await NotificationService.createExpertAssignmentNotification(
                        adminUser,
                        expertId,
                        lessonUpdated._id,
                        lessonUpdated.title
                    ).catch(err => console.error('Error notifying expert assignment:', err));
                }

                // Notificar a grupo de desarrollo (excluyendo líder y experto si están dentro)
                const excludeIds = new Set([leaderId?.toString(), expertId?.toString()].filter(Boolean));
                const devGroupToNotify = developmentGroupIds
                    .map(id => id?.toString())
                    .filter(id => id && !excludeIds.has(id));

                if (devGroupToNotify.length > 0) {
                    await NotificationService.createDevelopmentGroupAssignmentNotification(
                        adminUser,
                        devGroupToNotify,
                        lessonUpdated._id,
                        lessonUpdated.title
                    ).catch(err => console.error('Error notifying development group assignment:', err));
                }
            }
        } catch (notifyErr) {
            console.error('Error sending assignment notifications:', notifyErr);
        }

        // Verificar si es una experiencia y cambió el estado de aceptación
        if (currentLesson.class === 'experience' && updateData.hasOwnProperty('accepted') && currentLesson.accepted !== updateData.accepted) {
            try {
                console.log("Processing experience notifications...");
                if (updateData.accepted === true) {
                    // Experiencia aprobada
                    await NotificationService.createExperienceApprovedNotification(
                        currentLesson.author._id,
                        lessonId,
                        currentLesson.title,
                        req.user.sub
                    );
                    console.log('Notificación de experiencia aprobada enviada');
                } else if (updateData.accepted === false) {
                    // Experiencia rechazada
                    await NotificationService.createExperienceRejectedNotification(
                        currentLesson.author._id,
                        lessonId,
                        currentLesson.title,
                        req.user.sub,
                        updateData.rejectionReason || ''
                    );
                    console.log('Notificación de experiencia rechazada enviada');
                }
            } catch (notificationError) {
                console.error('Error enviando notificación de experiencia:', notificationError);
                // No fallar la operación principal por errores de notificación
            }
        }

        // Notificar a admins y lesson_managers cuando una lección pasa a "completed"
        try {
            const stateChangedToCompleted = updateData.state === 'completed' && currentLesson.state !== 'completed';
            if (stateChangedToCompleted) {
                console.log("Lesson state changed to completed, notifying admins and lesson managers...");
                
                // Obtener información del usuario que completó la lección
                const lessonLeader = await User.findById(req.user.sub).select('name surname _id');
                
                if (lessonLeader) {
                    await NotificationService.createLessonCompletedNotification(
                        lessonLeader,
                        lessonUpdated._id,
                        lessonUpdated.title
                    ).catch(err => console.error('Error notifying lesson completion:', err));
                    console.log('Notificaciones de lección completada enviadas a administradores y gestores');
                }
            }
        } catch (notifyErr) {
            console.error('Error sending lesson completion notifications:', notifyErr);
        }

        console.log("Lesson updated successfully, preparing response...");
        console.log("Response lesson ID:", lessonUpdated._id);
        return res.status(200).send({ lesson: lessonUpdated });
    } catch (err) {
        console.error("Error updating lesson:", err);
        console.error("Error stack:", err.stack);
        
        // Manejo específico de errores de MongoDB
        if (err.name === 'ValidationError') {
            console.error("MongoDB Validation Error:", err.errors);
            return res.status(400).send({ 
                message: 'Validation error', 
                errors: err.errors,
                details: Object.keys(err.errors).map(key => ({
                    field: key,
                    message: err.errors[key].message
                }))
            });
        }
        
        if (err.name === 'CastError') {
            console.error("MongoDB Cast Error:", err.message);
            return res.status(400).send({ 
                message: 'Invalid data type', 
                field: err.path,
                value: err.value,
                expectedType: err.kind
            });
        }
        
        if (err.code === 11000) {
            console.error("MongoDB Duplicate Key Error:", err.keyValue);
            return res.status(400).send({ 
                message: 'Duplicate key error', 
                duplicateFields: err.keyValue 
            });
        }
        
        return res.status(500).send({ 
            message: 'Error updating lesson', 
            error: err.message,
            errorName: err.name
        });
    }
};


const getLesson = async (req, res) => {
    const { id: lessonId } = req.params;

    try {
        console.log('getLesson called for lesson:', lessonId);
        
        // Primero obtener la lección sin populate para ver los datos raw
        const rawLesson = await Lesson.findById(lessonId);
        console.log('RAW lesson data:', {
            _id: rawLesson._id,
            expert: rawLesson.expert,
            suggested_facilitator: rawLesson.suggested_facilitator,
            author: rawLesson.author
        });
        
        // Usar la nueva función que incluye populate de call.interested
        const lesson = await populateLessonWithCall(Lesson.findById(lessonId));
            
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        console.log('getLesson - lesson found:', lesson._id);
        console.log('getLesson - RAW lesson before populate check:', {
            expert: lesson.expert,
            suggested_facilitator: lesson.suggested_facilitator,
            author: lesson.author
        });
        console.log('getLesson - expert populated:', lesson.expert);
        console.log('getLesson - suggested_facilitator populated:', lesson.suggested_facilitator);
        console.log('getLesson - author populated:', lesson.author);
        console.log('getLesson - call.interested populated:', lesson.call?.interested?.length || 0);
        
        return res.status(200).send({ lesson });
    } catch (err) {
        console.error('Error in getLesson:', err);
        return handleError(res, 'Error retrieving lesson', 500);
    }
};
const getLessons = async (req, res) => {
    console.log('=== getLessons CALLED ===');
    console.log('req.params:', req.params);
    console.log('req.query:', req.query);
    
    const { visibleOnes, page = 1 } = req.params;
    const accepted = visibleOnes === 'true';
    
    console.log('visibleOnes:', visibleOnes, 'accepted:', accepted, 'page:', page);
    
    // Para admin: si visibleOnes es 'true', mostrar solo accepted: true
    // Para admin: si visibleOnes es 'false', mostrar solo accepted: false  
    // Para admin: si visibleOnes es 'all', mostrar todas
    let query = {};
    if (visibleOnes === 'all') {
        // No filtrar por accepted - mostrar todas las lecciones
        query = {};
        console.log('Admin mode: Showing ALL lessons (accepted and not accepted)');
    } else {
        // Filtrar normalmente por accepted
        query = { accepted };
        console.log('Normal mode: Filtering by accepted =', accepted);
    }
    console.log('ITEMS_PER_PAGE value:', ITEMS_PER_PAGE);
    
    // Verificar que ITEMS_PER_PAGE existe
    if (!ITEMS_PER_PAGE) {
        console.error('ITEMS_PER_PAGE is undefined!');
        return res.status(500).send({ message: 'ITEMS_PER_PAGE configuration error' });
    }
    
    const limit = ITEMS_PER_PAGE;
    const skip = (parseInt(page) - 1) * limit;
    
    console.log('Calculated - limit:', limit, 'skip:', skip);

    try {
        console.log('Testing simple query first...');
        
        // Primero, probar query simple sin populate
        const simpleCount = await Lesson.countDocuments({});
        console.log('Total lessons in database:', simpleCount);
        
        const simpleLessons = await Lesson.find({}).limit(1);
        console.log('Sample lesson found:', simpleLessons.length > 0 ? 'YES' : 'NO');
        
        // Ahora la query real
        console.log('Starting main query with query:', query);
        const lessons = await Lesson.find(query)
            .skip(skip)
            .limit(limit)
            .populate('author', 'name surname picture role _id')
            .populate({ path: 'knowledge_area', model: 'KnowledgeArea', select: 'name' });

        console.log('Lessons found with basic populate:', lessons.length);
        
        // Debug: verificar contenido de las lecciones
        if (lessons.length > 0) {
            const firstLesson = lessons[0];
            console.log('Sample lesson data:');
            console.log('- Title:', firstLesson.title);
            console.log('- Author populated:', !!firstLesson.author);
            console.log('- Author name:', firstLesson.author?.name);
            console.log('- Knowledge areas populated:', !!firstLesson.knowledge_area);
            console.log('- Knowledge areas count:', firstLesson.knowledge_area?.length);
            console.log('- Level data:', firstLesson.level);
            console.log('- Level type:', typeof firstLesson.level);
        }
        
        const total = await Lesson.countDocuments(query);
        console.log("Total lessons with query:", query, "=", total);

        return res.status(200).send({
            lessons,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (err) {
        console.error("=== ERROR in getLessons ===");
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        console.error("Error name:", err.name);
        return res.status(500).send({ 
            message: 'Error getting lessons', 
            error: err.message,
            details: err.stack 
        });
    }
};




const getAllLessons = async (req, res) => {
    console.log('=== getAllLessons CALLED ===');
    console.log('req.params:', req.params);
    
    const { visibleOnes, order } = req.params;
    const accepted = visibleOnes === 'true';
    const sortOrder = order ? { [order]: -1 } : { created_at: -1 };
    
    console.log("getAllLessons - visibleOnes:", visibleOnes, "accepted:", accepted, "order:", order);
    
    // Aplicar la misma lógica que en getLessons
    let query = {};
    if (visibleOnes === 'all') {
        query = {};
        console.log('getAllLessons Admin mode: Showing ALL lessons');
    } else {
        query = { accepted };
        console.log('getAllLessons Normal mode: Filtering by accepted =', accepted);
    }
    console.log("sortOrder:", sortOrder);
    console.log("ITEMS_PER_PAGE:", ITEMS_PER_PAGE);
    
    // Verificar configuración
    if (!ITEMS_PER_PAGE) {
        console.error('ITEMS_PER_PAGE is undefined in getAllLessons!');
        return res.status(500).send({ message: 'ITEMS_PER_PAGE configuration error' });
    }
    
    try {
        console.log('Starting getAllLessons query...');
        
        // Query con populate básico
        console.log('getAllLessons - Using query:', query);
        const lessons = await Lesson.find(query)
            .sort(sortOrder)
            .populate('author', 'name surname picture role _id')
            .populate('development_group', 'name surname picture role _id')
            .populate('leader', 'name surname picture role _id')
            .populate('expert', 'name surname picture role _id')
            .populate({ path: 'knowledge_area', model: 'KnowledgeArea', select: 'name' })
            .populate({
                path: 'call.interested',
                select: 'name surname picture role _id'
            });
        
        console.log('Lessons query completed, found:', lessons.length);
        
        // Debug: verificar populate de call.interested y development_group
        const lessonsWithCalls = lessons.filter(lesson => lesson.call && lesson.call.interested);
        console.log('Lessons with calls:', lessonsWithCalls.length);
        if (lessonsWithCalls.length > 0) {
            console.log('First lesson with call.interested:', {
                id: lessonsWithCalls[0]._id,
                interestedCount: lessonsWithCalls[0].call.interested.length,
                interestedTypes: lessonsWithCalls[0].call.interested.map(i => typeof i)
            });
        }
        
        // Debug: verificar populate de development_group
        const lessonsWithDevGroup = lessons.filter(lesson => lesson.development_group && lesson.development_group.length > 0);
        console.log('Lessons with development_group:', lessonsWithDevGroup.length);
        if (lessonsWithDevGroup.length > 0) {
            console.log('First lesson with development_group:', {
                id: lessonsWithDevGroup[0]._id,
                devGroupCount: lessonsWithDevGroup[0].development_group.length,
                devGroupTypes: lessonsWithDevGroup[0].development_group.map(i => typeof i),
                firstMember: lessonsWithDevGroup[0].development_group[0]?.name || 'No name'
            });
        }
        
        
        const total = await Lesson.countDocuments(query);
        console.log("getAllLessons - Total lessons found with query:", total);
        
        res.status(200).send({ 
            lessons, 
            total, 
            pages: Math.ceil(total / ITEMS_PER_PAGE) 
        });
    } catch (err) {
        console.error("=== ERROR in getAllLessons ===");
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        console.error("Error name:", err.name);
        return res.status(500).send({ 
            message: 'Error in getAllLessons', 
            error: err.message,
            details: err.stack 
        });
    }
};

const getMyLessons = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        // Determinar el ID correcto del usuario
        const userId = req.user._id || req.user.sub || req.user.id;
        console.log('getMyLessons called for user:', userId, 'page:', page);
        
        if (!userId) {
            console.error('ERROR: No user ID found in req.user (getMyLessons)');
            return handleError(res, 'User ID not found', 400);
        }
        
        // Usar la misma lógica que getAllMyLessons - excluir lecciones vacías del autor
        const query = {
            $or: [
                { 
                    author: userId,
                    $or: [
                        { development_group: { $exists: true, $ne: [], $not: { $size: 0 } } }, // Tiene miembros
                        { leader: { $exists: true, $ne: null } }, // Tiene líder asignado
                        { expert: { $exists: true, $ne: null } }  // Tiene experto asignado
                    ]
                },
                { leader: userId },
                { expert: userId },
                { development_group: { $in: [userId] } } // ✅ Usar $in para arrays
            ]
        };
        
        const lessons = await Lesson.paginate(query, { 
            page, 
            limit: ITEMS_PER_PAGE,
            populate: populateLesson()
        });
        
        console.log('Raw paginated lessons found:', lessons.docs.length);
        
        // Filtro adicional en JavaScript para las lecciones paginadas
        const filteredDocs = lessons.docs.filter(lesson => {
            if (lesson.author && lesson.author._id.toString() === userId.toString()) {
                const hasMembers = lesson.development_group && lesson.development_group.length > 0;
                const hasLeader = lesson.leader && lesson.leader !== null;
                const hasExpert = lesson.expert && lesson.expert !== null;
                
                console.log(`Paginated Lesson "${lesson.title}" - HasMembers: ${hasMembers}, HasLeader: ${hasLeader}, HasExpert: ${hasExpert}`);
                
                return hasMembers || hasLeader || hasExpert;
            }
            return true;
        });
        
        // Actualizar el objeto de respuesta con las lecciones filtradas
        lessons.docs = filteredDocs;
        lessons.totalDocs = filteredDocs.length;
        
        console.log('Found paginated lessons for user (filtered):', filteredDocs.length);
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        console.error('Error in getMyLessons:', err);
        handleError(res, 'Error fetching your lessons');
    }
};

const getAllMyLessons = async (req, res) => {
    try {
        console.log('=== getAllMyLessons DEBUG ===');
        console.log('Full req.user object:', JSON.stringify(req.user, null, 2));
        
        // Determinar el ID correcto del usuario
        const userId = req.user._id || req.user.sub || req.user.id;
        console.log('Determined user ID:', userId);
        console.log('User name:', req.user.name);
        
        if (!userId) {
            console.error('ERROR: No user ID found in req.user');
            return handleError(res, 'User ID not found', 400);
        }
        
        // Buscar lecciones donde el usuario es:
        // 1. Autor (author) - SOLO si development_group no está vacío O tiene líder/experto
        // 2. Líder (leader) 
        // 3. Experto (expert)
        // 4. Miembro del grupo de desarrollo (development_group)
        const query = {
            $or: [
                { 
                    author: userId,
                    $or: [
                        { development_group: { $exists: true, $ne: [], $not: { $size: 0 } } }, // Tiene miembros (no vacío)
                        { leader: { $exists: true, $ne: null } }, // Tiene líder asignado (no null)
                        { expert: { $exists: true, $ne: null } }  // Tiene experto asignado (no null)
                    ]
                },
                { leader: userId },
                { expert: userId },
                { development_group: { $in: [userId] } } // ✅ Usar $in para arrays
            ]
        };
        
        console.log('MongoDB query:', JSON.stringify(query, null, 2));
        
        // Test directo: buscar lecciones donde este usuario esté en development_group
        const directTest = await Lesson.find({ 
            development_group: { $in: [userId] } 
        }).select('title development_group');
        console.log('Direct test - lessons with user in development_group:', directTest.length);
        directTest.forEach(lesson => {
            console.log(`  - "${lesson.title}": development_group IDs = [${lesson.development_group.join(', ')}]`);
        });
        
        const lessons = await Lesson.find(query).populate(populateLesson());
        
        console.log('Raw lessons found:', lessons.length);
        
        // Debug específico para cada lección encontrada
        lessons.forEach((lesson, index) => {
            console.log(`Lesson ${index}: "${lesson.title}"`);
            console.log(`  - Author: ${lesson.author?.name} (${lesson.author?._id})`);
            console.log(`  - Leader: ${lesson.leader?.name || 'None'} (${lesson.leader?._id || 'None'})`);
            console.log(`  - Expert: ${lesson.expert?.name || 'None'} (${lesson.expert?._id || 'None'})`);
            console.log(`  - Development group: ${lesson.development_group?.length || 0} members`);
            if (lesson.development_group && lesson.development_group.length > 0) {
                lesson.development_group.forEach((member, i) => {
                    console.log(`    ${i}: ${member.name} (${member._id})`);
                });
            }
        });
        
        // Filtro adicional en JavaScript para asegurar que funcione
        const filteredLessons = lessons.filter(lesson => {
            // Si el usuario es el autor, verificar condiciones adicionales
            if (lesson.author && lesson.author._id.toString() === userId.toString()) {
                const hasMembers = lesson.development_group && lesson.development_group.length > 0;
                const hasLeader = lesson.leader && lesson.leader !== null;
                const hasExpert = lesson.expert && lesson.expert !== null;
                
                console.log(`Lesson "${lesson.title}" - Author: ${lesson.author.name}, HasMembers: ${hasMembers}, HasLeader: ${hasLeader}, HasExpert: ${hasExpert}`);
                
                // Solo incluir si tiene miembros, líder o experto
                return hasMembers || hasLeader || hasExpert;
            }
            
            // Si no es el autor, incluir la lección (es líder, experto o miembro)
            return true;
        });
        
        console.log('Found lessons for user (filtered):', filteredLessons.length);
        res.status(200).send({ lessons: filteredLessons });
    } catch (err) {
        console.error('Error in getAllMyLessons:', err);
        handleError(res, 'Error fetching all your lessons');
    }
};

const getLessonsToAdvise = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        console.log('=== getLessonsToAdvise called ===');
        console.log('Full req.user object:', JSON.stringify(req.user, null, 2));
        console.log('req.user._id:', req.user._id);
        console.log('req.user.sub:', req.user.sub);
        console.log('req.user.id:', req.user.id);
        console.log('Page:', page);
        
        // Obtener el ID del usuario con fallbacks
        const userId = req.user._id || req.user.sub || req.user.id;
        console.log('Resolved userId:', userId);
        
        if (!userId) {
            return res.status(401).send({ message: 'Usuario no autenticado correctamente' });
        }
        
        // Buscar lecciones donde el usuario es:
        // 1. Facilitador sugerido (suggested_facilitator) en estado 'proposed' (Invitaciones)
        // 2. Facilitador asignado (expert) en estados posteriores
        const query = { 
            $or: [
                { 
                    suggested_facilitator: userId,
                    state: 'proposed',
                    accepted: false
                },
                {
                    expert: userId,
                    state: { $in: ['assigned', 'development', 'test', 'completed'] }
                }
            ]
        };
        
        console.log('Query:', JSON.stringify(query, null, 2));
        
        const lessons = await Lesson.paginate(query, { 
            page, 
            limit: ITEMS_PER_PAGE,
            populate: populateLesson()
        });
        
        console.log('Found lessons to advise:', lessons.docs.length);
        lessons.docs.forEach(lesson => {
            console.log(`- ${lesson.title} (${lesson.state}) - suggested_facilitator: ${lesson.suggested_facilitator?._id || lesson.suggested_facilitator} - expert: ${lesson.expert?._id || lesson.expert}`);
        });
        
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        console.error('Error in getLessonsToAdvise:', err);
        handleError(res, 'Error fetching lessons to advise');
    }
};

const getAllLessonsToAdvise = async (req, res) => {
    try {
        console.log('=== getAllLessonsToAdvise called ===');
        console.log('Full req.user object:', JSON.stringify(req.user, null, 2));
        console.log('req.user._id:', req.user._id);
        console.log('req.user.sub:', req.user.sub);
        console.log('req.user.id:', req.user.id);
        
        // Obtener el ID del usuario con fallbacks
        const userId = req.user._id || req.user.sub || req.user.id;
        console.log('Resolved userId:', userId);
        
        if (!userId) {
            return res.status(401).send({ message: 'Usuario no autenticado correctamente' });
        }
        
        // Buscar lecciones donde el usuario es:
        // 1. Facilitador sugerido (suggested_facilitator) en estado 'proposed' (Invitaciones)
        // 2. Facilitador asignado (expert) en estados posteriores
        const query = { 
            $or: [
                { 
                    suggested_facilitator: userId,
                    state: 'proposed'
                },
                {
                    expert: userId,
                    state: { $in: ['assigned', 'development', 'test', 'completed'] }
                }
            ]
        };
        
        console.log('Query:', JSON.stringify(query, null, 2));
        
        const lessons = await Lesson.find(query).populate(populateLesson());
        
        console.log('Found all lessons to advise:', lessons.length);
        lessons.forEach(lesson => {
            console.log(`- ${lesson.title} (${lesson.state}) - suggested_facilitator: ${lesson.suggested_facilitator?._id || lesson.suggested_facilitator} - expert: ${lesson.expert?._id || lesson.expert}`);
        });
        
        res.status(200).send({ lessons });
    } catch (err) {
        console.error('Error in getAllLessonsToAdvise:', err);
        handleError(res, 'Error fetching all lessons to advise');
    }
};

const getSuggestLessons = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        const lessons = await Lesson.paginate({ justification: { $ne: null }, accepted: false }, { page, limit: ITEMS_PER_PAGE });
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching suggested lessons');
    }
};

const getCalls = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        // Identificar usuario solicitante
        const userId = (req.user && (req.user._id || req.user.sub || req.user.id)) || null;

        // Filtro base por estados (excluir las activas/en desarrollo)
        const stateFilter = { state: { $nin: ['assigned', 'development', 'test', 'completed'] } };
        console.log('stateFilter:', stateFilter);
        console.log('userId:', userId);
        // Visibilidad: todos los visibles para cualquiera; y además incluir no visibles si el solicitante es el líder
        const visibilityFilter = userId
            ? { $or: [
                    { "call.visible": true },
                    { $and: [ { "call.visible": false }, { leader: userId } ] }
                ] }
            : { "call.visible": true };
        console.log('visibilityFilter:', visibilityFilter);
        const query = { $and: [ stateFilter, visibilityFilter ] };

        const lessons = await Lesson.paginate(
            query,
            { 
                page, 
                limit: ITEMS_PER_PAGE,
                populate: [
                    { path: 'author', select: 'name surname picture role _id' },
                    { path: 'leader', select: 'name surname picture role _id' },
                    { path: 'expert', select: 'name surname picture role _id' },
                    { path: 'suggested_facilitator', select: 'name surname picture role _id' },
                    { path: 'knowledge_area', select: 'name' },
                    { path: 'call.interested', select: 'name surname picture role _id' }
                ]
            }
        );
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching calls');
    }
};

const getAllCalls = async (req, res) => {
    try {
        const userId = (req.user && (req.user._id || req.user.sub || req.user.id)) || null;
        const stateFilter = { state: { $nin: ['assigned', 'development', 'test', 'completed'] } };
        const visibilityFilter = userId
            ? { $or: [ { "call.visible": true }, { $and: [ { "call.visible": false }, { leader: userId } ] } ] }
            : { "call.visible": true };

        const query = { $and: [ stateFilter, visibilityFilter ] };

        const lessons = await Lesson.find(query)
            .populate('author', 'name surname picture role _id')
            .populate('leader', 'name surname picture role _id')
            .populate('expert', 'name surname picture role _id')
            .populate('suggested_facilitator', 'name surname picture role _id')
            .populate('knowledge_area', 'name')
            .populate('call.interested', 'name surname picture role _id');
        res.status(200).send({ lessons });
    } catch (err) {
        handleError(res, 'Error fetching all calls');
    }
};

const getExperiences = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        const lessons = await Lesson.paginate({  type: { $ne: null }, accepted: false }, { page, limit: ITEMS_PER_PAGE });
        sendPaginatedResponse(res, lessons);
    } catch (err) {
        handleError(res, 'Error fetching experiences');
    }
};




// Helper to populate lesson fields consistently
function populateLesson() {
    try {
        return [
            { path: 'author', select: 'name surname picture role _id' },
            { path: 'leader', select: 'name surname picture role _id' },
            { path: 'expert', select: 'name surname picture role _id' },
            { path: 'suggested_facilitator', select: 'name surname picture role _id' },
            { path: 'development_group', select: 'name surname picture role _id' },
            { path: 'knowledge_area', model: 'KnowledgeArea', select: 'name' },
            { path: 'son_lesson', select: '_id visible' }
        ];
    } catch (error) {
        console.error('Error in populateLesson:', error);
        return [];
    }
}

// Helper to populate lesson with call.interested (requires separate populate call)
async function populateLessonWithCall(lessonQuery) {
    try {
        console.log('=== populateLessonWithCall DEBUG ===');
        const lesson = await lessonQuery
            .populate(populateLesson())
            // Popular comentarios de la lección y sus usuarios para vistas que dependen de ellos (e.g., rating)
            .populate({
                path: 'comments',
                populate: { path: 'user', select: 'name surname picture role _id' }
            })
            .populate({
                path: 'call.interested',
                select: 'name surname picture role _id'
            })
            .populate({
                path: 'conversations.author',
                select: 'name surname picture role _id'
            })
            .populate({
                path: 'expert_comments.author',
                select: 'name surname picture role _id'
            });
        
        console.log('populateLessonWithCall - lesson ID:', lesson._id);
        console.log('populateLessonWithCall - expert:', lesson.expert);
        console.log('populateLessonWithCall - suggested_facilitator:', lesson.suggested_facilitator);
        console.log('populateLessonWithCall - author:', lesson.author);
        console.log('populateLessonWithCall - development_group populated:', lesson.development_group?.length || 0);
        console.log('populateLessonWithCall - conversations authors populated:', Array.isArray(lesson.conversations) ? lesson.conversations.filter(m=>m.author && m.author.name).length : 0);
        console.log('populateLessonWithCall - expert_comments authors populated:', Array.isArray(lesson.expert_comments) ? lesson.expert_comments.filter(m=>m.author && m.author.name).length : 0);
        console.log('populateLessonWithCall - populate config used:', populateLesson());
        
        return lesson;
    } catch (error) {
        console.error('Error in populateLessonWithCall:', error);
        // Fallback to basic populate
        return await lessonQuery.populate(populateLesson());
    }
}

// ===== ENDPOINT DE VERIFICACIÓN DE TOKEN =====

const verifyToken = async (req, res) => {
    try {
        // Si llegamos aquí, el middleware auth.ensureAuth ya verificó el token
        // Solo necesitamos confirmar que el usuario existe
        const userId = req.user?.sub;
        
        if (!userId) {
            return res.status(401).send({ 
                valid: false, 
                message: 'Token no contiene información de usuario válida' 
            });
        }

        // Verificar que el usuario aún existe en la base de datos
        const user = await User.findById(userId).select('_id name surname actived');
        
        if (!user) {
            return res.status(401).send({ 
                valid: false, 
                message: 'Usuario no encontrado' 
            });
        }

        if (!user.actived) {
            return res.status(401).send({ 
                valid: false, 
                message: 'Usuario desactivado' 
            });
        }

        return res.status(200).send({ 
            valid: true, 
            message: 'Token válido',
            user: {
                _id: user._id,
                name: user.name,
                surname: user.surname
            }
        });
        
    } catch (err) {
        console.error('Error in verifyToken:', err);
        return res.status(401).send({ 
            valid: false, 
            message: 'Error verificando token' 
        });
    }
};

// ===== ENDPOINT DE PRUEBA PARA DEBUGGING =====

const testEndpoint = async (req, res) => {
    console.log('=== TEST ENDPOINT CALLED ===');
    
    try {
        console.log('Testing basic functionality...');
        console.log('ITEMS_PER_PAGE:', ITEMS_PER_PAGE);
        console.log('Lesson model available:', !!Lesson);
        console.log('User model available:', !!User);
        
        // Test básico de configuración
        const config = require('../config.json');
        console.log('Config loaded:', config);
        
        // Test de conexión a base de datos
        const testCount = await Lesson.countDocuments({});
        console.log('Database connection test - total lessons:', testCount);
        
        return res.status(200).send({
            message: 'Test endpoint working',
            config: config,
            totalLessons: testCount,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Test endpoint error:', err);
        return res.status(500).send({
            message: 'Test endpoint failed',
            error: err.message,
            stack: err.stack
        });
    }
};

// ===== NUEVAS FUNCIONES PARA NOTIFICACIONES =====

// Añadir mensaje a conversación de lección
const addLessonMessage = async (req, res) => {
    const { id: lessonId } = req.params;
    const { text, conversationTitle, file } = req.body;

    try {
        const lesson = await Lesson.findById(lessonId).populate('author leader expert development_group');
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        // Crear el nuevo mensaje
        const newMessage = {
            text,
            author: req.user.sub,
            conversationTitle: conversationTitle || 'General',
            created_at: new Date(),
            file: file || null
        };

        // Añadir mensaje a la lección (si es conversación del grupo) o a expert_comments si el autor es el experto y conversationTitle coincide con uno de experto
        // Por simplicidad mantenemos en conversations cuando viene de conversación general; expert usa expert_comments desde front
        lesson.conversations.push(newMessage);
        const updatedLesson = await lesson.save();

        // Obtener todos los participantes de la lección
        const participants = new Set();
        if (lesson.author) participants.add(lesson.author._id.toString());
        if (lesson.leader) participants.add(lesson.leader._id.toString());
        if (lesson.expert) participants.add(lesson.expert._id.toString());
        if (lesson.development_group) {
            lesson.development_group.forEach(member => participants.add(member._id.toString()));
        }

        // Convertir a array y filtrar al usuario actual
        const participantIds = Array.from(participants).filter(id => id !== req.user.sub.toString());

        // Crear notificaciones
        if (participantIds.length > 0) {
            await NotificationService.createLessonMessageNotification(
                req.user,
                participantIds,
                lesson._id,
                lesson.title,
                text
            ).catch(err => console.error('Error creating lesson message notification:', err));
        }

        return res.status(200).send({ lesson: updatedLesson });
    } catch (err) {
        console.error('Error adding lesson message:', err);
        return handleError(res, 'Error adding message to lesson');
    }
};

// Editar mensaje existente (solo dentro de 30 minutos)
const EDIT_WINDOW_MINUTES = 30;
const editLessonMessage = async (req, res) => {
    const { id: lessonId, messageId } = req.params;
    const { text, scope } = req.body; // scope: 'conversations' | 'expert_comments'

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) return handleError(res, 'Lesson not found', 404);

        const collection = scope === 'expert_comments' ? lesson.expert_comments : lesson.conversations;
        const message = collection.id(messageId) || collection.find(m => m._id.toString() === messageId.toString());
        if (!message) return handleError(res, 'Message not found', 404);

        // Permitir solo autor del mensaje
        if (message.author.toString() !== req.user.sub.toString()) {
            return handleError(res, 'Forbidden', 403);
        }

        // Validar ventana de edición
        const createdAt = new Date(message.created_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
        if (diffMinutes > EDIT_WINDOW_MINUTES) {
            return handleError(res, 'Edit window expired', 400);
        }

        message.text = text;
        message.edited = true;
        message.edited_at = new Date();

        const updatedLesson = await lesson.save();

        // Notificar a participantes sobre edición (opcional)
        try {
            const participants = new Set();
            if (lesson.author) participants.add(lesson.author.toString());
            if (lesson.leader) participants.add(lesson.leader.toString());
            if (lesson.expert) participants.add(lesson.expert.toString());
            if (lesson.development_group) {
                lesson.development_group.forEach(u => participants.add(u.toString()));
            }
            participants.delete(req.user.sub.toString());
            if (participants.size > 0) {
                await NotificationService.createLessonMessageNotification(
                    req.user,
                    Array.from(participants),
                    lesson._id,
                    lesson.title,
                    '[mensaje editado] ' + (text || '')
                );
            }
        } catch (notifyErr) {
            console.error('Error creating edit notification:', notifyErr);
        }

        // Devolver poblado
        const populated = await populateLessonWithCall(Lesson.findById(updatedLesson._id));
        return res.status(200).send({ lesson: populated });
    } catch (err) {
        console.error('Error editing lesson message:', err);
        return handleError(res, 'Error editing message');
    }
};

// Agregar comentario de experto/facilitador con notificaciones
const addExpertComment = async (req, res) => {
    const { id: lessonId } = req.params;
    const { text, conversationTitle, file } = req.body;

    try {
        const lesson = await Lesson.findById(lessonId).populate('author leader expert development_group');
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        // Crear el nuevo comentario de experto
        const newComment = {
            text,
            author: req.user.sub,
            conversationTitle: conversationTitle || 'General',
            created_at: new Date(),
            file: file || null
        };

        // Añadir comentario a expert_comments
        lesson.expert_comments.push(newComment);
        const updatedLesson = await lesson.save();

        // Obtener todos los participantes de la lección (excepto el facilitador que escribe)
        const participants = new Set();
        if (lesson.author) participants.add(lesson.author._id.toString());
        if (lesson.leader) participants.add(lesson.leader._id.toString());
        if (lesson.expert && lesson.expert._id.toString() !== req.user.sub.toString()) {
            participants.add(lesson.expert._id.toString());
        }
        if (lesson.development_group) {
            lesson.development_group.forEach(member => participants.add(member._id.toString()));
        }

        // Filtrar al usuario actual
        const participantIds = Array.from(participants).filter(id => id !== req.user.sub.toString());

        // Crear notificaciones
        if (participantIds.length > 0) {
            await NotificationService.createLessonMessageNotification(
                req.user,
                participantIds,
                lesson._id,
                lesson.title,
                text
            ).catch(err => console.error('Error creating expert comment notification:', err));
        }

        // Poblar la lección actualizada para la respuesta
        await updatedLesson.populate('author leader expert development_group');
        
        return res.status(200).send({ lesson: updatedLesson });
    } catch (err) {
        console.error('Error adding expert comment:', err);
        return handleError(res, 'Error adding expert comment');
    }
};

// Cambiar estado de lección
const changeLessonState = async (req, res) => {
    const { id: lessonId } = req.params;
    const { state, reason } = req.body;

    try {
        const lesson = await Lesson.findById(lessonId).populate('author leader expert development_group');
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        const oldState = lesson.state;
        lesson.state = state;
        
        const updatedLesson = await lesson.save();

        // Obtener todos los participantes de la lección
        const participants = new Set();
        if (lesson.author) participants.add(lesson.author._id.toString());
        if (lesson.leader) participants.add(lesson.leader._id.toString());
        if (lesson.expert) participants.add(lesson.expert._id.toString());
        if (lesson.development_group) {
            lesson.development_group.forEach(member => participants.add(member._id.toString()));
        }

        const participantIds = Array.from(participants);

        // Crear notificaciones de cambio de estado
        if (participantIds.length > 0 && oldState !== state) {
            await NotificationService.createLessonStateChangeNotification(
                req.user,
                participantIds,
                lesson._id,
                lesson.title,
                oldState,
                state,
                reason
            ).catch(err => console.error('Error creating lesson state change notification:', err));
        }

        return res.status(200).send({ lesson: updatedLesson });
    } catch (err) {
        console.error('Error changing lesson state:', err);
        return handleError(res, 'Error changing lesson state');
    }
};

// Crear o actualizar convocatoria (solo líder/autor y en estado approved_by_expert)
const createCall = async (req, res) => {
    const { id: lessonId } = req.params;
    const { text, visible = true } = req.body;

    try {
        const lesson = await Lesson.findById(lessonId)
            .populate('author', 'name surname _id')
            .populate('leader', 'name surname _id');
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        // Permisos: solo líder o autor
        const currentUserId = (req.user && (req.user.sub || req.user._id || req.user.id))?.toString();
        const authorId = (lesson.author && lesson.author._id ? lesson.author._id : lesson.author)?.toString();
        const leaderId = (lesson.leader && lesson.leader._id ? lesson.leader._id : lesson.leader)?.toString();
        const isLeaderOrAuthor = currentUserId && (currentUserId === authorId || currentUserId === leaderId);
        if (!isLeaderOrAuthor) {
            return handleError(res, 'Only the project leader can open or edit the call', 403);
        }

        // Estado permitido: cuando el facilitador avaló (accepted=true) o cuando ya esté approved_by_expert
        if (!(lesson.accepted === true || lesson.state === 'approved_by_expert')) {
            return handleError(res, 'Call can only be opened after facilitator acceptance', 400);
        }

        // Actualizar la convocatoria
        lesson.call = {
            text,
            visible,
            author: currentUserId,
            interested: lesson.call?.interested || [],
            created_at: new Date()
        };

        const updatedLesson = await lesson.save();

        // Si la convocatoria es visible, notificar a usuarios interesados
        if (visible && lesson.call?.interested?.length > 0) {
            await NotificationService.createCallNotification(
                req.user,
                lesson.call.interested,
                lesson._id,
                lesson.title,
                text
            ).catch(err => console.error('Error creating call notification:', err));
        }

        return res.status(200).send({ lesson: updatedLesson });
    } catch (err) {
        console.error('Error creating call:', err);
        return handleError(res, 'Error creating call');
    }
};

// Mostrar interés en convocatoria
const showInterestInCall = async (req, res) => {
    const { id: lessonId } = req.params;

    try {
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        if (!lesson.call) {
            return handleError(res, 'No call available for this lesson', 400);
        }

        // Añadir usuario a la lista de interesados si no está ya
        if (!lesson.call.interested.includes(req.user.sub)) {
            lesson.call.interested.push(req.user.sub);
            await lesson.save();
        }

        return res.status(200).send({ message: 'Interest registered successfully' });
    } catch (err) {
        console.error('Error showing interest in call:', err);
        return handleError(res, 'Error registering interest');
    }
};

// ===== NUEVOS ENDPOINTS PARA PERFIL DE LECCIONES =====

/**
 * Obtener lecciones públicas de un usuario específico
 * GET /api/users/:userId/lessons/public
 */
const getUserPublicLessons = async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const role = req.query.role; // 'author', 'collaborator', 'reviewer', 'all'
    const area = req.query.area;
    const limit = ITEMS_PER_PAGE;

    try {
        // Verificar que el usuario existe
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return handleError(res, 'User not found', 404);
        }

        // Verificar configuración de privacidad del usuario
        const privacySettings = targetUser.lessonsPrivacySettings || { 
            showLessonsInProfile: true, 
            hiddenLessonIds: [], 
            allowCollaborationRequests: true 
        };

        if (!privacySettings.showLessonsInProfile) {
            return res.status(200).send({
                lessons: [],
                totalCount: 0,
                hasMore: false,
                page: page,
                totalPages: 0,
                message: 'User has disabled lessons visibility'
            });
        }

        // Determinar si el solicitante es el propietario del perfil
        const isOwner = req.user && req.user.sub === userId;

        // Construir query base por participación del usuario
        let query = {
            $or: [
                { author: userId },
                { leader: userId },
                { expert: userId },
                { development_group: userId }
            ]
        };

        // Filtros por estado/visibilidad según sea propietario o visitante
        if (!isOwner) {
            // Visitantes: solo completadas, públicas, aceptadas y no ocultas por privacidad
            query.state = 'completed';
            query.visible = true;
            query.accepted = true;
            query._id = { $nin: privacySettings.hiddenLessonIds };
        } else {
            // Propietario: permitir ver ocultas y no restringir por visible; mantener completadas/aceptadas
            query.state = 'completed';
            query.accepted = true;
        }

        // Aplicar filtro por área si se envía
        if (area) {
            query.knowledge_area = area;
        }

        // Paginar resultados
        const options = {
            page: page,
            limit: limit,
            populate: populateLesson(),
            sort: { updated_at: -1 } // Ordenar por última actualización
        };

        const result = await Lesson.paginate(query, options);

        // Transformar resultados para incluir rol del usuario
        const transformedLessons = result.docs.map(lesson => {
            const lessonObj = lesson.toObject();
            
            // Determinar el rol del usuario en esta lección
            let userRole = 'author';
            if (lesson.author && lesson.author._id.toString() === userId) {
                userRole = 'author';
            } else if (lesson.leader && lesson.leader._id.toString() === userId) {
                userRole = 'collaborator';
            } else if (lesson.expert && lesson.expert._id.toString() === userId) {
                userRole = 'reviewer';
            } else if (lesson.development_group && lesson.development_group.some(member => member._id.toString() === userId)) {
                userRole = 'collaborator';
            }

            return {
                ...lessonObj,
                userRole: userRole,
                completionDate: lesson.updated_at || lesson.created_at
            };
        });

        // Filtrar por rol si se especifica
        let filteredLessons = transformedLessons;
        if (role && role !== 'all') {
            filteredLessons = transformedLessons.filter(lesson => lesson.userRole === role);
        }

        return res.status(200).send({
            lessons: filteredLessons,
            totalCount: result.totalDocs,
            hasMore: result.hasNextPage,
            page: result.page,
            totalPages: result.totalPages,
            currentPage: result.page
        });

    } catch (err) {
        console.error('Error fetching user public lessons:', err);
        return handleError(res, 'Error fetching user lessons');
    }
};

/**
 * Obtener estadísticas de lecciones de un usuario
 * GET /api/users/:userId/lessons/stats
 */
const getUserLessonsStats = async (req, res) => {
    const { userId } = req.params;

    try {
        // Verificar que el usuario existe
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return handleError(res, 'User not found', 404);
        }

        // Obtener todas las lecciones del usuario
        const lessons = await Lesson.find({
            $or: [
                { author: userId },
                { leader: userId },
                { expert: userId },
                { development_group: userId }
            ]
        }).populate('knowledge_area', 'name');

        // Filtrar solo lecciones completadas para estadísticas públicas
        const completedLessons = lessons.filter(lesson => lesson.state === 'completed');

        // Calcular estadísticas por rol
        let totalAsAuthor = 0;
        let totalAsCollaborator = 0;
        let totalAsReviewer = 0;

        completedLessons.forEach(lesson => {
            if (lesson.author && lesson.author.toString() === userId) {
                totalAsAuthor++;
            }
            if (lesson.leader && lesson.leader.toString() === userId) {
                totalAsCollaborator++;
            }
            if (lesson.expert && lesson.expert.toString() === userId) {
                totalAsReviewer++;
            }
            if (lesson.development_group && lesson.development_group.some(member => member.toString() === userId)) {
                totalAsCollaborator++;
            }
        });

        // Calcular áreas de conocimiento
        const areaCount = {};
        completedLessons.forEach(lesson => {
            if (lesson.knowledge_area && lesson.knowledge_area.length > 0) {
                lesson.knowledge_area.forEach(area => {
                    const areaName = area.name || area;
                    areaCount[areaName] = (areaCount[areaName] || 0) + 1;
                });
            }
        });

        const knowledgeAreas = Object.entries(areaCount).map(([name, count]) => ({
            name,
            count
        }));

        // Calcular rating promedio
        const ratingsSum = completedLessons.reduce((sum, lesson) => sum + (lesson.score || 0), 0);
        const averageRating = completedLessons.length > 0 ? ratingsSum / completedLessons.length : 0;

        // Calcular actividad mensual (últimos 6 meses)
        const sixMonthsAgo = moment().subtract(6, 'months').unix();
        const recentLessons = completedLessons.filter(lesson => {
            const lessonDate = moment(lesson.updated_at, 'X').unix();
            return lessonDate >= sixMonthsAgo;
        });

        const monthlyActivity = [];
        for (let i = 5; i >= 0; i--) {
            const month = moment().subtract(i, 'months');
            const monthStart = month.startOf('month').unix();
            const monthEnd = month.endOf('month').unix();
            
            const monthCount = recentLessons.filter(lesson => {
                const lessonDate = moment(lesson.updated_at, 'X').unix();
                return lessonDate >= monthStart && lessonDate <= monthEnd;
            }).length;

            monthlyActivity.push({
                month: month.format('MMMM'),
                completedCount: monthCount
            });
        }

        const stats = {
            totalCompleted: completedLessons.length,
            totalAsAuthor,
            totalAsCollaborator,
            totalAsReviewer,
            averageRating: Math.round(averageRating * 10) / 10, // Redondear a 1 decimal
            knowledgeAreas,
            monthlyActivity
        };

        return res.status(200).send(stats);

    } catch (err) {
        console.error('Error fetching user lessons stats:', err);
        return handleError(res, 'Error fetching user lessons statistics');
    }
};

/**
 * Actualizar configuración de privacidad de lecciones
 * PUT /api/users/lessons/privacy
 */
const updateLessonsPrivacy = async (req, res) => {
    const userId = req.user.sub; // Usuario autenticado
    const { showLessonsInProfile, hiddenLessonIds, allowCollaborationRequests } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return handleError(res, 'User not found', 404);
        }

        // Actualizar configuración de privacidad
        const privacySettings = {
            showLessonsInProfile: showLessonsInProfile !== undefined ? showLessonsInProfile : true,
            hiddenLessonIds: hiddenLessonIds || [],
            allowCollaborationRequests: allowCollaborationRequests !== undefined ? allowCollaborationRequests : true
        };

        user.lessonsPrivacySettings = privacySettings;
        await user.save();

        return res.status(200).send({
            message: 'Privacy settings updated successfully',
            privacySettings: user.lessonsPrivacySettings
        });

    } catch (err) {
        console.error('Error updating lessons privacy settings:', err);
        return handleError(res, 'Error updating privacy settings');
    }
};

/**
 * Alternar visibilidad de una lección específica
 * PUT /api/lessons/:lessonId/visibility
 */
const toggleLessonVisibility = async (req, res) => {
    const { lessonId } = req.params;
    const { visible } = req.body;
    const userId = req.user.sub;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return handleError(res, 'User not found', 404);
        }

        // Verificar que la lección existe
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        // Verificar que el usuario tiene permisos sobre la lección
        const hasPermission = lesson.author.toString() === userId ||
                            lesson.leader?.toString() === userId ||
                            lesson.expert?.toString() === userId ||
                            lesson.development_group?.some(member => member.toString() === userId);

        if (!hasPermission) {
            return handleError(res, 'You do not have permission to modify this lesson visibility', 403);
        }

        // Inicializar configuración de privacidad si no existe
        if (!user.lessonsPrivacySettings) {
            user.lessonsPrivacySettings = {
                showLessonsInProfile: true,
                hiddenLessonIds: [],
                allowCollaborationRequests: true
            };
        }

        // Actualizar lista de lecciones ocultas
        const hiddenIds = user.lessonsPrivacySettings.hiddenLessonIds || [];
        const lessonIndex = hiddenIds.indexOf(lessonId);

        if (visible && lessonIndex > -1) {
            // Mostrar lección (remover de ocultas)
            hiddenIds.splice(lessonIndex, 1);
        } else if (!visible && lessonIndex === -1) {
            // Ocultar lección (agregar a ocultas)
            hiddenIds.push(lessonId);
        }

        user.lessonsPrivacySettings.hiddenLessonIds = hiddenIds;
        await user.save();

        return res.status(200).send({
            message: 'Lesson visibility updated successfully',
            lessonId,
            visible,
            hiddenLessonIds: user.lessonsPrivacySettings.hiddenLessonIds
        });

    } catch (err) {
        console.error('Error toggling lesson visibility:', err);
        return handleError(res, 'Error updating lesson visibility');
    }
};

/**
 * Obtener configuración de privacidad actual
 * GET /api/users/lessons/privacy
 */
const getLessonsPrivacy = async (req, res) => {
    const userId = req.user.sub;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return handleError(res, 'User not found', 404);
        }

        const privacySettings = user.lessonsPrivacySettings || {
            showLessonsInProfile: true,
            hiddenLessonIds: [],
            allowCollaborationRequests: true
        };

        return res.status(200).send(privacySettings);

    } catch (err) {
        console.error('Error fetching lessons privacy settings:', err);
        return handleError(res, 'Error fetching privacy settings');
    }
};

// ===== FUNCIONES PARA FACILITADOR SUGERIDO =====

// Respuesta del facilitador a la invitación
const respondToFacilitatorInvitation = async (req, res) => {
    const { id: lessonId } = req.params;
    const { response, reason } = req.body; // response: 'accept' | 'reject', reason: string opcional
    const facilitatorId = req.user.sub;

    try {
        const lesson = await Lesson.findById(lessonId)
            .populate('author', 'name surname email')
            .populate('suggested_facilitator', 'name surname email');

        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        // Verificar que el usuario es el facilitador sugerido
        if (!lesson.suggested_facilitator || lesson.suggested_facilitator._id.toString() !== facilitatorId) {
            return handleError(res, 'You are not the suggested facilitator for this lesson', 403);
        }

        const facilitator = await User.findById(facilitatorId);
        
        if (response === 'accept') {
            // Aceptar la invitación: mover a expert y auto-aprobar
            lesson.expert = facilitatorId;
            lesson.accepted = true;
            lesson.state = 'assigned'; // Cambiar estado a asignado
            lesson.suggested_facilitator = null; // Limpiar el campo de sugerencia
            
            await lesson.save();

            // Obtener administradores para notificaciones
            const adminUsers = await User.find({
                $or: [
                    { role: 'admin' },
                    { role: 'delegated_admin' }
                ]
            }).select('_id');

            const adminIds = adminUsers.map(admin => admin._id);

            // Enviar notificaciones
            try {
                // Notificar auto-aprobación
                await NotificationService.createLessonAutoApprovedByFacilitatorNotification(
                    facilitator,
                    lesson._id,
                    lesson.title,
                    adminIds,
                    lesson.author._id
                );

                console.log('Notificaciones de auto-aprobación enviadas');
            } catch (notificationError) {
                console.error('Error enviando notificaciones de auto-aprobación:', notificationError);
            }

            return res.status(200).send({
                message: 'Invitation accepted successfully. The lesson has been automatically approved.',
                lesson: lesson
            });

        } else if (response === 'reject') {
            // Rechazar la invitación
            lesson.suggested_facilitator = null; // Limpiar el campo de sugerencia
            await lesson.save();

            // Obtener administradores para notificaciones
            const adminUsers = await User.find({
                $or: [
                    { role: 'admin' },
                    { role: 'delegated_admin' }
                ]
            }).select('_id');

            const adminIds = adminUsers.map(admin => admin._id);

            // Enviar notificaciones de rechazo
            try {
                await NotificationService.createFacilitatorRejectedNotification(
                    facilitator,
                    lesson._id,
                    lesson.title,
                    adminIds,
                    lesson.author._id,
                    reason
                );

                console.log('Notificaciones de rechazo enviadas');
            } catch (notificationError) {
                console.error('Error enviando notificaciones de rechazo:', notificationError);
            }

            return res.status(200).send({
                message: 'Invitation rejected successfully.',
                lesson: lesson
            });

        } else {
            return handleError(res, 'Invalid response. Must be "accept" or "reject"', 400);
        }

    } catch (err) {
        console.error('Error responding to facilitator invitation:', err);
        return handleError(res, 'Error processing facilitator response');
    }
};

// Obtener invitaciones pendientes del facilitador
const getFacilitatorInvitations = async (req, res) => {
    const facilitatorId = req.user.sub;

    try {
        const invitations = await Lesson.find({
            suggested_facilitator: facilitatorId,
            expert: { $exists: false } // Solo invitaciones pendientes
        })
        .populate('author', 'name surname email')
        .populate('knowledge_area', 'name')
        .select('title resume justification level knowledge_area created_at')
        .sort({ created_at: -1 });

        return res.status(200).send({
            invitations: invitations,
            total: invitations.length
        });

    } catch (err) {
        console.error('Error fetching facilitator invitations:', err);
        return handleError(res, 'Error fetching invitations');
    }
};

// ===== FUNCIONES PARA APROBACIÓN/RECHAZO DE FACILITADOR SUGERIDO =====

const approveFacilitatorSuggestion = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const facilitatorId = req.user._id || req.user.sub || req.user.id;

        console.log('=== approveFacilitatorSuggestion NUEVO FLUJO ===');
        console.log('Lesson ID:', lessonId);
        console.log('Facilitator ID:', facilitatorId);

        // Buscar la lección con populate
        const lesson = await Lesson.findById(lessonId)
            .populate('author', 'name surname _id')
            .populate('expert', 'name surname _id')

        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        console.log('Lesson found:', lesson.title);
        console.log('Current expert:', lesson.expert);
        console.log('Current suggested_facilitator:', lesson.suggested_facilitator);
        console.log('Current state:', lesson.state);

        // Verificar que el usuario sea el facilitador sugerido
        if (!lesson.suggested_facilitator || lesson.suggested_facilitator._id.toString() !== facilitatorId.toString()) {
            console.error('User is not the suggested facilitator');
            return handleError(res, 'You are not the suggested facilitator for this lesson', 403);
        }

        // Verificar que la lección esté en estado 'proposed'
        if (lesson.state !== 'proposed') {
            console.error('Lesson is not in proposed state:', lesson.state);
            return handleError(res, 'Lesson must be in proposed state to approve', 400);
        }

        // Nuevo flujo: el facilitador avala sin cambiar el estado; marcamos accepted=true
        lesson.expert = lesson.suggested_facilitator;
        lesson.accepted = true;
        lesson.approved_at = new Date();
        // Mantener state en 'proposed'
        lesson.state = 'proposed';
        lesson.leader = lesson.author._id;
        lesson.development_group = [lesson.author._id];

        await lesson.save();

        // 3. Notificar al líder/autor usando el nuevo servicio de notificación
        await NotificationService.createFacilitatorApprovedLessonForLeaderNotification(
            req.user,
            lesson._id,
            lesson.title,
            lesson.author._id
        );

        // 4. Notificar a administradores (opcional, para seguimiento)
        const admins = await User.find({ role: { $in: ['admin', 'delegated_admin'] } });
        const adminIds = admins.map(admin => admin._id);
        
        if (adminIds.length > 0) {
            const adminNotifications = adminIds.map(adminId => ({
                user: adminId,
                type: 'lesson',
                title: 'Lección aprobada por facilitador (Flujo Autónomo)',
                content: `La lección "${lesson.title}" ha sido aprobada por ${req.user.name} ${req.user.surname}. Ahora El líder debe abrir la convocatoria.`,
                link: `/admin/lecciones?lesson=${lesson._id}&action=manage`,
                relatedId: lesson._id,
                relatedModel: 'Lesson',
                from: facilitatorId,
                priority: 'medium'
            }));

            await Notification.insertMany(adminNotifications);
        }

        console.log('✅ FACILITADOR AVALÓ LA LECCIÓN:');
        console.log('- accepted:', lesson.accepted);
        console.log('- state:', lesson.state);
        console.log('- Líder notificado para gestionar convocatoria');

        res.status(200).send({ 
            message: 'Lesson accepted by facilitator',
            lesson: lesson,
            acceptedFlow: true
        });

    } catch (err) {
        console.error('Error in approveFacilitatorSuggestion:', err);
        return handleError(res, 'Error approving lesson', 500);
    }
};

const rejectFacilitatorSuggestion = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { reason } = req.body;
        const facilitatorId = (req.user && (req.user._id || req.user.sub || req.user.id)) || null;

        console.log('rejectFacilitatorSuggestion called:', { lessonId, facilitatorId, reason });

        if (!facilitatorId) {
            return handleError(res, 'User not authenticated correctly', 401);
        }

        // Buscar la lección con populate para notificaciones
        const lesson = await Lesson.findById(lessonId).populate('author', 'name surname email');
        if (!lesson) {
            return handleError(res, 'Lesson not found', 404);
        }

        // Verificar que el usuario sea el facilitador (puede estar en suggested_facilitator o expert)
        const suggestedFacilitatorId = (lesson.suggested_facilitator && lesson.suggested_facilitator._id)
            ? lesson.suggested_facilitator._id
            : lesson.suggested_facilitator;
        const expertId = (lesson.expert && lesson.expert._id)
            ? lesson.expert._id
            : lesson.expert;

        const isSuggestedFacilitator = suggestedFacilitatorId && suggestedFacilitatorId.toString() === facilitatorId.toString();
        const isExpert = expertId && expertId.toString() === facilitatorId.toString();

        if (!isSuggestedFacilitator && !isExpert) {
            return handleError(res, 'You are not the facilitator for this lesson', 403);
        }

        // Obtener información del facilitador para notificaciones
        const facilitator = await User.findById(facilitatorId).select('name surname email');

        // CASO 1: Lección ya aceptada (accepted=true) - Solo retirarse y notificar al admin
        if (lesson.accepted === true) {
            console.log('Lección ya aceptada - Facilitador se retira y se notifica al admin');
            
            // Remover al facilitador de la lección
            lesson.expert = null;
            lesson.suggested_facilitator = null;
            lesson.rejection_reason = reason || 'El facilitador se retiró de la lección';
            lesson.rejected_at = new Date();
            // NO cambiar el estado - mantener 'proposed' para que admin pueda reasignar

            await lesson.save();

            // Notificar a administradores y gestores de lecciones
            try {
                const adminUsers = await User.find({
                    $or: [
                        { role: 'admin' },
                        { role: 'delegated_admin' },
                        { role: 'lesson_manager' }
                    ]
                }).select('_id');

                const adminIds = adminUsers.map(admin => admin._id);

                if (adminIds.length > 0) {
                    const adminNotifications = adminIds.map(adminId => ({
                        user: adminId,
                        type: 'lesson',
                        title: 'Facilitador se retiró de lección aceptada',
                        content: `${facilitator.name} ${facilitator.surname} se retiró de la lección "${lesson.title}". Motivo: ${lesson.rejection_reason}. Se requiere asignar un nuevo facilitador.`,
                        link: `/admin/lecciones?lesson=${lesson._id}`,
                        relatedId: lesson._id,
                        relatedModel: 'Lesson',
                        from: facilitatorId,
                        priority: 'high'
                    }));

                    await Notification.insertMany(adminNotifications);
                    console.log('Notificaciones enviadas a administradores sobre retiro de facilitador');
                }
            } catch (notificationError) {
                console.error('Error creating admin notification:', notificationError);
            }

            // Notificar al autor también
            try {
                await NotificationService.createNotification({
                    user: lesson.author._id,
                    type: 'lesson',
                    title: 'El facilitador se retiró de tu lección',
                    content: `${facilitator.name} ${facilitator.surname} se retiró de tu lección "${lesson.title}". Un administrador asignará un nuevo facilitador pronto.`,
                    lesson: lessonId
                });
            } catch (notificationError) {
                console.error('Error creating author notification:', notificationError);
            }

            console.log('Facilitator withdrawn from accepted lesson:', lessonId);
            return res.status(200).send({ 
                message: 'Te has retirado de la lección. Un administrador asignará un nuevo facilitador.',
                lesson: lesson,
                withdrawn: true
            });
        }

        // CASO 2: Lección NO aceptada aún - Rechazo completo
        console.log('Lección no aceptada - Rechazo completo');
        
        lesson.suggested_facilitator = null;
        lesson.expert = null;
        lesson.state = 'rejected_by_facilitator';
        lesson.rejection_reason = reason || 'No reason provided';
        lesson.rejected_at = new Date();

        await lesson.save();

        // Notificar al autor que el facilitador rechazó
        try {
            await NotificationService.createNotification({
                user: lesson.author._id,
                type: 'lesson',
                title: 'Tu experiencia necesita un nuevo facilitador',
                content: `El facilitador ha rechazado tu experiencia "${lesson.title}". Motivo: ${lesson.rejection_reason}. Por favor, selecciona un nuevo facilitador.`,
                lesson: lessonId
            });
        } catch (notificationError) {
            console.error('Error creating facilitator rejection notification:', notificationError);
        }

        console.log('Facilitator rejected lesson successfully:', lessonId);
        res.status(200).send({ 
            message: 'Lesson rejected successfully',
            lesson: lesson,
            withdrawn: false
        });

    } catch (err) {
        console.error('Error in rejectFacilitatorSuggestion:', err);
        return handleError(res, 'Error rejecting lesson', 500);
    }
};

module.exports = {
    saveLesson,
    deleteLesson,
    updateLesson,
    getLessons,
    getLesson,
    getAllLessons,
    getMyLessons,
    getAllMyLessons,
    getLessonsToAdvise,
    getAllLessonsToAdvise,
    getSuggestLessons,
    getCalls,
    getAllCalls,
    getExperiences,
    uploadLessonFiles,
    getLessonFile,
    // Función de verificación de token
    verifyToken,
    // Función de prueba para debugging
    testEndpoint,
    // Funciones para notificaciones
    addLessonMessage,
    editLessonMessage,
    addExpertComment,
    changeLessonState,
    createCall,
    showInterestInCall,
    // Nuevas funciones para perfil de lecciones
    getUserPublicLessons,
    getUserLessonsStats,
    updateLessonsPrivacy,
    toggleLessonVisibility,
    getLessonsPrivacy,
    // Nuevas funciones para facilitador sugerido
    respondToFacilitatorInvitation,
    getFacilitatorInvitations,
    approveFacilitatorSuggestion,
    rejectFacilitatorSuggestion
}
