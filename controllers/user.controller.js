'use strict'

// Retrieve the algorithm and key size values from environment variables
const algorithm = process.env.ALGORITHM || 'HS256'; // Use default value 'HS256' if environment variable is not set
const keySize = parseInt(process.env.KEYSIZE) || 32; // Use default value 32 if environment variable is not set or is not a valid integer

// Libraries
const crypto = require('crypto');
let bcrypt = require('bcryptjs');
let moment = require('moment');
let fs = require('fs');
let path = require('path');
const winston = require('winston');

const { v4: uuidv4 } = require('uuid');

// Services
let jwt = require('../services/jwt.service');
let mail = require('../services/mail.service');

// Models
let User = require('../models/user.model');
let Follow = require('../models/follow.model');
let Publication = require('../models/publication.model');
const Institution = require('../models/institution.model'); 
const Profession = require('../models/profession.model'); 
const Lesson = require('../models/lesson.model');
const { cleanupUserReferences } = require('../scripts/cleanup-orphan-user-refs');

// Constant
const { ITEMS_PER_PAGE } = require('../config');
const USERS_PATH = './uploads/users/';
const saltR = 10;
const saveUser = async (req, res) => {
    const params = req.body;
    const user = new User();

    if (params.name && params.surname && params.email && params.password && params.role) {
        user.name = params.name;
        user.surname = params.surname;
        user.password = params.password;
        user.email = params.email.toLowerCase();
        user.about = params.about;
        user.role = params.role;
        user.postgraduate = params.postgraduate;
        user.knowledge_area = params.knowledge_area;
        user.city = params.city;
        user.contactNumber = params.contactNumber;
        user.socialNetworks = params.socialNetworks;
        user.created_at = moment().unix();

        try {
            // Check if the institution exists or create a new one
            if (params.institution && typeof params.institution === 'object' && params.institution.name) {
                let institution = await Institution.findOne({ name: params.institution.name });
                if (!institution) {
                    institution = new Institution(params.institution);
                    await institution.save();
                }
                user.institution = institution._id;
            } else if (params.institution && typeof params.institution === 'string') {
                user.institution = params.institution;
            }

            // Check if the profession exists or create a new one
            if (params.profession && typeof params.profession === 'object' && params.profession.name) {
                let profession = await Profession.findOne({ name: params.profession.name });
                if (!profession) {
                    profession = new Profession(params.profession);
                    await profession.save();
                }
                user.profession = profession._id;
            } else if (params.profession && typeof params.profession === 'string') {
                user.profession = params.profession;
            }

            const users = await User.find({ email: user.email });
            if (users && users.length >= 1) {
                return res.status(200).send({ message: 'User already exists' });
            } else {
                const salt = await bcrypt.genSalt(saltR);
                user.password = await bcrypt.hash(params.password, salt);
                const userStored = await user.save();
                mail.sendMail(
                    'Nuevo usuario registrado',
                    process.env.EMAIL,
                    `
                    <h3>Hola ${process.env.NAME}</h3>
                    <p>Se ha registrado el usuario 
                    <strong>${userStored.name} ${userStored.surname}</strong>
                     con el correo electrónico 
                    ${userStored.email}.</p>
                    <p>
                    Ingresa al <strong>panel de administración</strong> de RedDinámica para revisar la información 
                     del nuevo usuario.
                     </p>
                    `
                );
                
                // Notificar a los administradores sobre el nuevo usuario
                try {
                    const adminUsers = await User.find({ role: { $in: ['admin', 'delegated_admin'] } }, '_id');
                    const adminIds = adminUsers.map(admin => admin._id);
                    
                    if (adminIds.length > 0) {
                        const NotificationService = require('../services/notification.service');
                        await NotificationService.createNewUserRegistrationNotification(userStored, adminIds);
                        console.log(`New user registration notification sent to ${adminIds.length} administrators`);
                    }
                } catch (notificationErr) {
                    console.error('Error creating new user registration notification:', notificationErr);
                    // No fallar la creación del usuario por un error de notificación
                }
                
                delete userStored.password;
                return res.status(200).send({ user: userStored });
            }
        } catch (err) {
            console.error('Error saving user:', err); // Enhanced error logging
            return res.status(500).send({ message: 'Error in the request. The user can not be saved' });
        }
    } else {
        console.warn('Missing required fields:', params); // Log missing fields for debugging
        return res.status(400).send({ message: 'You must fill all the required fields' });
    }
};


const saveUserByAdmin = async (req, res) => {
    const params = req.body;
    const user = new User();

    params.password = uuidv4().substr(0, 6);
    
    if (params.name && params.surname && params.email && params.role) {
        user.name = params.name;
        user.surname = params.surname;
        user.password = params.password;
        user.email = params.email.toLowerCase();
        user.about = params.about;
        user.actived = true;
        user.role = params.role;
        user.postgraduate = params.postgraduate;
        user.knowledge_area = params.knowledge_area;
        user.profession = params.profession;
        user.institution = params.institution;
        user.city = params.city;
        user.created_at = moment().unix();

        try {
            const users = await User.find({ email: user.email });
            if (users && users.length >= 1) {
                return res.status(200).send({ message: 'User already exists' });
            } else {
                const salt = await bcrypt.genSalt(saltR);
                user.password = await bcrypt.hash(params.password, salt);
                const userStored = await user.save();
                mail.sendMail(
                    'Contraseña Reddinámica',
                    userStored.email,
                    `
                    <h3>Bienvenido a RedDinámica</h3>
                    <p>La contraseña de inicio de sesión en RedDinámica es:  <strong>${params.password}</strong></p>
                    
                    Se recomienda cambiar la contraseña una vez se inicie sesión, esto se puede realizar ingresando a <strong>Opciones de seguridad</strong>.`
                );
                userStored.password = null;
                return res.status(200).send({ user: userStored });
            }
        } catch(err) {
            return res.status(500).send({ message: 'Error in the request. The user can not be saved' });
        }
    } else {
        return res.status(200).send({ message: 'Debes llenar todos los campos*****' });
    }
};
const login = async (req, res) => {
    const params = req.body;
    const email = params.email;
    const password = params.password;

    try {
        const user = await User.findOneAndUpdate({ email: email }, { $inc: { visits: 0.5 } }, { new: true })
            .populate('city')
            .populate('profession')
            .populate('institution')
            .exec();

        if (user) {
            const check = await bcrypt.compare(password, user.password);
            if (check) {
                if (params.getToken) {
                    return res.status(200).send({ token: jwt.createToken(user,algorithm,keySize) });
                } else {
                    user.password = null;
                    return res.status(200).send({ user: user });
                }
            } else {
                return res.status(200).send({
                    message: 'The user can not be logged in!',
                    email: true
                });
            }
        } else {
            return res.status(200).send({
                message: 'El email no esta registrado',
                email: false
            });
        }
    } catch(err) {
        return res.status(500).send({ message: 'Error in the request. The user can not be logged in' });
    }
};

const validatePassword = async (req, res) => {
    const params = req.body;
    const password = params.password;
    const email = req.user.email;

    try {
        const user = await User.findOne({ email: email }).exec();
        if (user) {
            const check = await bcrypt.compare(password, user.password);
            return res.status(200).send(check);
        } else {
            return res.status(404).send({ message: 'The user cannot be found' });
        }
    } catch(err) {
        return res.status(500).send({ message: 'Error in the request. The user can not be validate' });
    }
};

const changePassword = async (req, res) => {
    const params = req.body;
    const password = params.password;
    const userId = req.user.sub;

    const salt = await bcrypt.genSalt(saltR);
    const hash = await bcrypt.hash(password, salt);

    try {
        const userUpdated = await User.findByIdAndUpdate(userId, { password: hash }, { new: true }).exec();
        if (!userUpdated) return res.status(404).send({ message: 'The user can not be updated' });
        userUpdated.password = null;
        return res.status(200).send({ user: userUpdated });
    } catch(err) {
        return res.status(500).send({ message: 'Error in the request. User has not been updated' });
    }
};

const recoverPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email }).exec();
        if (!user) {
            return res.status(404).send({ message: 'Usuario no encontrado' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // El token expira en 1 hora
        const resetPasswordUrl = process.env.NODE_ENV === 'production'
        ? process.env.HASH_URL + process.env.RESET_PASSWORD_URL
        : "http://localhost:4200/#/" + process.env.RESET_PASSWORD_URL;

        user.resetPasswordToken = token;
        user.resetPasswordExpires = expires;

        await user.save();

        const resetLink = `${resetPasswordUrl}${token}`;
        await mail.sendMail(
            'Restablecimiento de Contraseña para RedDinámica',
            user.email,
            `
            <h3>Solicitud de Restablecimiento de Contraseña</h3>
            <p>Has solicitado un restablecimiento de contraseña para tu cuenta de RedDinámica. Haz clic en el enlace a continuación para restablecer tu contraseña:</p>
            <p><a href="${resetLink}">Restablecer Contraseña</a></p>
            <p>Si no solicitaste esto, por favor ignora este correo.</p>
            `
        );
        res.status(200).json({ user: { _id: user._id, email: user.email }, message: 'Correo de restablecimiento de contraseña enviado' });
    } catch (err) {
        console.log(err);
        res.status(500).send({ message: 'Error en la solicitud' });
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        }).exec();

        if (!user) {
            return res.status(400).send({ message: 'Token de restablecimiento de contraseña inválido o expirado' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        user.password = hash;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).send({ user, message: 'Contraseña restablecida correctamente' });
    } catch (err) {
        res.status(500).send({ message: 'Error en la solicitud' });
    }
};


const getUser = async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await User.findById(userId)
            .populate('city')
            .populate('profession')
            .populate('institution')
            .exec();
        if (!user) return res.status(404).send({ message: 'User doesn\'t exist' });
        user.password = null;
        const value = await followThisUser(req.user.sub, userId);
        return res.status(200).send({ user, following: value.following, follower: value.follower });
    } catch(err) {
        return res.status(500).send({ message: 'Error in the request. User can not be found' });
    }
};

const getNewUsers = async (req, res) => {
    const page = parseInt(req.params.page) || 1;

    try {
        const options = {
            page: page,
            limit: ITEMS_PER_PAGE,
            sort: { name: 1 }, // Sorting by name ascending
            populate: [
                { path: 'city' },
                { path: 'profession' },
                { path: 'institution' }
            ]
        };

        const result = await User.paginate({ actived: false }, options);

        // Instead of returning 404, just return the empty data with a 200 status code
        return res.status(200).send({
            users: result.docs, // The actual users data, can be empty array
            totalItems: result.totalDocs,
            totalPages: result.totalPages,
            currentPage: result.page,
            itemsPerPage: result.limit,
        });
    } catch(err) {
        console.error(err);
        return res.status(500).send({ message: 'Error in the request. Could not get records' });
    }
};

const updateUser = async (req, res) => {
    const userId = req.params.id;
    const update = req.body;
    delete update.password;

    if (userId != req.user.sub) {
        if (!['admin', 'delegated_admin'].includes(req.user.role)) {
            return res.status(401).send({ message: 'You do not have permission to update user data' });
        }
    }

    try {
        // Obtener el usuario antes de actualizarlo para comparar el estado
        const userBefore = await User.findById(userId);
        
        const userUpdated = await User.findByIdAndUpdate(userId, update, { new: true })
            .populate('city')
            .populate('profession')
            .populate('institution');
        if (!userUpdated) {
            return res.status(404).send({ message: 'The user can not be updated' });
        }
        
        // Si un admin está actualizando a otro usuario, invalidar sus tokens
        if (userId != req.user.sub && ['admin', 'delegated_admin'].includes(req.user.role)) {
            const TokenInvalidationService = require('../services/token-invalidation.service');
            TokenInvalidationService.markUserAsUpdated(userId);
            console.log(`Admin ${req.user.sub} updated user ${userId}. Tokens invalidated.`);
            
            // Si el usuario fue aprobado (cambió de actived: false a actived: true)
            if (!userBefore.actived && userUpdated.actived) {
                const NotificationService = require('../services/notification.service');
                try {
                    await NotificationService.createUserApprovedNotification(userId, req.user.sub);
                    console.log(`User approval notification sent to user ${userId}`);
                } catch (notificationErr) {
                    console.error('Error creating user approval notification:', notificationErr);
                }
            }
        }
        
        userUpdated.password = null;
        return res.status(200).send({ user: userUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. User has not been updated' });
    }
};

// Actualizar preferencias del usuario autenticado (p. ej., emailDigestEnabled)
const updatePreferences = async (req, res) => {
    const userId = req.user.sub;
    const { emailDigestEnabled } = req.body || {};

    if (typeof emailDigestEnabled !== 'boolean') {
        return res.status(400).send({ message: 'Campo emailDigestEnabled inválido o ausente' });
    }

    try {
        const update = { emailDigestEnabled };
        const userUpdated = await User.findByIdAndUpdate(userId, update, { new: true })
            .populate('city')
            .populate('profession')
            .populate('institution');
        if (!userUpdated) {
            return res.status(404).send({ message: 'Usuario no encontrado' });
        }
        userUpdated.password = null;
        return res.status(200).send({ user: userUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error actualizando preferencias' });
    }
};

// Obtener preferencias del usuario autenticado
const getMyPreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user.sub).select('emailDigestEnabled');
        if (!user) {
            return res.status(404).send({ message: 'Usuario no encontrado' });
        }
        return res.status(200).send({ emailDigestEnabled: user.emailDigestEnabled !== false });
    } catch (err) {
        return res.status(500).send({ message: 'Error obteniendo preferencias' });
    }
};
const deleteUser = async (req, res) => {
    const userId = req.params.id || req.user.sub;
    const user = {
        name:'Usuario RedDinámica',
        surname:'',
        password:'',        
        about:'',        
        role:'',
        email:'',
        postgraduate:'',
        knowledge_area:'',
        profession:null,
        institution:null,
        city:null,
        actived:null,
        created_at:moment().unix()
    }   

    try {
        const userRemoved = await User.findOneAndUpdate({ _id: userId }, user);

        if (!userRemoved) {
            return res.status(404).send({ message: 'The user can not be removed, it has not been found' });
        }

        await Follow.deleteMany({ $or: [{ followed: userId }, { user: userId }] });
        await Publication.deleteMany({ user: userId });

        // Ejecutar limpieza de referencias huérfanas en segundo plano (no bloquear respuesta)
        try {
            setImmediate(async () => {
                try {
                    const result = await cleanupUserReferences(userId);
                    winston.info('cleanupUserReferences completed', { userId, result });
                } catch (cleanupErr) {
                    winston.warn('cleanupUserReferences failed', cleanupErr);
                }
            });
        } catch (scheduleErr) {
            winston.warn('Failed to schedule cleanupUserReferences', scheduleErr);
        }

        return res.status(200).send({ user: userRemoved });
    } catch (err) {
        winston.error(err);
        return res.status(500).send({ message: 'Error in the request. The user can not be removed' });
    }
}

const uploadProfilePic = async (req, res) => {
    const userId = req.params.id;
    const filePath = req.file.path;
    const filename = req.file.filename;

    if (req.file) {
        if (userId != req.user.sub) {
            return removeFilesOfUpdates(res, 403, filePath, 'You do not have permission to update user data');
        }

        try {
            const userUpdated = await User.findByIdAndUpdate(userId, { picture: filename }, { new: true });

            if (!userUpdated) {
                return removeFilesOfUpdates(res, 404, filePath, 'The user has not been updated');
            }

            userUpdated.password = null;
            return res.status(200).send({ user: userUpdated });
        } catch (err) {
            return removeFilesOfUpdates(res, 500, filePath, 'Error in the request. The image user can not be upadated');
        }
    } else {
        return res.status(200).send({ message: 'No file has been uploaded' });
    }
}

const getProfilePic = async (req, res) => {
    const imageFile = req.params.imageFile;
    const pathFile = path.resolve(USERS_PATH, imageFile);

    try {
        // Validate if the file exists
        await fs.promises.stat(pathFile);
        return res.sendFile(pathFile);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // Send 404 if file does not exist
            return res.status(404).send({ message: 'The image does not exist.' });
        } else {
            console.error('Error requesting profile picture:', err); // Log other errors
            return res.status(500).send({ message: 'Error requesting the image.' });
        }
    }
}

const followThisUser = async (identityUserId, userId) => {
    try {
        const following = await Follow.findOne({ "user": identityUserId, "followed": userId });
        const follower = await Follow.findOne({ "user": userId, "followed": identityUserId });
        return { following: following, follower: follower };
    } catch (err) {
        return handleError(err);
    }
}

const getUsers = async (req, res) => {
    const userId = req.user.sub;
    let page = req.params.page || 1; // Default to page 1 if no page is provided

    try {
        const options = {
            page: page,
            limit: ITEMS_PER_PAGE,
            sort: { created_at: -1 }, // Sorting by created at
            select: '-password', // Excluding password field
            populate: ['city', 'profession', 'institution']
        };

        const result = await User.paginate({ name: { $ne: 'Usuario RedDinámica' } }, options);
        if (!result) {
            return res.status(404).send({ message: 'There are no users' });
        }
        const value = await followsUserId(userId);

        return res.status(200).send({
            users: result.docs, // The paginated result documents
            following: value.following,
            followers: value.followers,
            totalItems: result.totalDocs, // Total number of documents that match the query
            totalPages: result.totalPages, // Total pages
            currentPage: result.page, // Current page number
            itemsPerPage: result.limit // Number of items per page
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).send({ message: 'Error in the request' });
    }
};

const getAllUsers = async (req, res) => {
    const userId = req.user.sub;

    try {
        const users = await User.find({name:{$ne: 'Usuario RedDinámica'}}, '-password').sort('name')
            .populate('city')
            .populate('profession')
            .populate('institution');

        if (!users.length) {
            return res.status(404).send({ message: 'There are not users' });
        }

        const value = await followsUserId(userId);
        return res.status(200).send({ users, following: value.following, followers: value.followers });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request' });
    }
}

// Búsqueda paginada por nombre o email (typeahead)
const searchUsers = async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit) || 8, 25);
    if (!q) {
        return res.status(200).send({ users: [] });
    }
    try {
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const users = await User.find(
            { $or: [ { name: regex }, { surname: regex }, { email: regex } ], name: { $ne: 'Usuario RedDinámica' } },
            'name surname email role picture'
        ).limit(limit).sort({ name: 1 });
        return res.status(200).send({ users });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request' });
    }
};

const followsUserId = async (userId) => {
    try {
        const following = await Follow.find({ user: userId }, { '_id': 0, '_v': 0, 'user': 0 });
        const following_clean = following.map(follow => follow.followed);

        const followers = await Follow.find({ followed: userId }, { '_id': 0, '_v': 0, 'followed': 0 });
        const followers_clean = followers.map(follow => follow.user);

        return { following: following_clean, followers: followers_clean };
    } catch (err) {
        return handleError(err);
    }
}

const removeFilesOfUpdates = async (res, httpCode, filePath, message) => {
    try {
        await fs.promises.unlink(filePath);
        return res.status(httpCode).send({ message: message });
    } catch (err) {
        return handleError(err);
    }
}

const getCounters = async (req, res) => {
    const userId = req.params.id || req.user.sub;

    try {
        const value = await getCountFollow(userId);
        return res.status(200).send(value);
    } catch (err) {
        // handle error
    }
}

const getCountFollow = async (userId) => {
    try {
        const following = await Follow.countDocuments({ user: userId });
        const followed = await Follow.countDocuments({ followed: userId });
        const publications = await Publication.countDocuments({ user: userId });
        
        // Contar lecciones en las que el usuario ha participado
        // Criterios:
        // - author: solo si tiene grupo de desarrollo, líder o experto asignado (consistencia con "Mis Lecciones")
        // - leader, expert o miembro del development_group
        const lessons = await Lesson.countDocuments({
            $or: [
                {
                    author: userId,
                    $or: [
                        { development_group: { $exists: true, $ne: [], $not: { $size: 0 } } },
                        { leader: { $exists: true, $ne: null } },
                        { expert: { $exists: true, $ne: null } }
                    ]
                },
                { leader: userId },
                { expert: userId },
                { development_group: { $in: [userId] } }
            ]
        });

        return {
            following: following,
            followed: followed,
            publications: publications,
            lessons: lessons
        }
    } catch (err) {
        return handleError(err);
    }
}

const forceUserLogout = async (req, res) => {
    const userId = req.params.id;
    
    // Solo admins pueden forzar logout de otros usuarios
    if (!['admin', 'delegated_admin'].includes(req.user.role)) {
        return res.status(401).send({ message: 'You do not have permission to logout other users' });
    }
    
    try {
        const TokenInvalidationService = require('../services/token-invalidation.service');
        TokenInvalidationService.markUserAsUpdated(userId);
        
        console.log(`Admin ${req.user.sub} forced logout for user ${userId}`);
        return res.status(200).send({ 
            message: 'User has been logged out successfully',
            userId: userId
        });
    } catch (err) {
        return res.status(500).send({ message: 'Error forcing user logout' });
    }
}

const getTokenStats = async (req, res) => {
    // Solo admins pueden ver estadísticas de tokens
    if (!['admin', 'delegated_admin'].includes(req.user.role)) {
        return res.status(401).send({ message: 'You do not have permission to view token statistics' });
    }
    
    try {
        const TokenInvalidationService = require('../services/token-invalidation.service');
        const stats = TokenInvalidationService.getStats();
        
        return res.status(200).send(stats);
    } catch (err) {
        return res.status(500).send({ message: 'Error getting token statistics' });
    }
}

module.exports = {
    saveUser,
    saveUserByAdmin,
    login,
    validatePassword,
    changePassword,
    recoverPassword,
    getUser,
    getUsers,
    getAllUsers,
    searchUsers,
    getNewUsers,
    getCounters,
    updateUser,
    deleteUser,
    uploadProfilePic,
    getProfilePic,
    resetPassword,
    forceUserLogout,
    getTokenStats,
    updatePreferences,
    getMyPreferences

}