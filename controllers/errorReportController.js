const fs = require('fs').promises;
const path = require('path');
const ErrorReport = require('../models/errorReport.model');
const NotificationService = require('../services/notification.service');
const User = require('../models/user.model');
const FILE_PATH = path.join(__dirname, '../uploads/errors/');

exports.createErrorReport = (req, res) => {
  const { category, type, module, description, steps, publicationId, reportedUserId } = req.body;
  
  // Validación de campos según la categoría
  if (!category || !type || !description) {
    return res.status(400).send({ message: 'Faltan campos obligatorios.' });
  }

  const attachment = req.file ? {
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    fileName: req.file.filename,
    groupTitle: 'error_reports',
    created_at: new Date()
  } : null;

  const errorReport = new ErrorReport({
    reporter: req.user.sub, // Guardar el usuario que reporta
    category,
    type,
    module: module || 'N/A',
    description,
    steps: steps || 'N/A',
    publicationId: publicationId || null,
    reportedUserId: reportedUserId || null,
    attachment,
    status: 'pending'
  });

  errorReport.save()
    .then(report => res.status(201).send(report))
    .catch(err => res.status(500).send({ message: 'Error al guardar el reporte.', error: err.message }));
};

exports.getFile = async (req, res) => {
  const { file } = req.params;
  const pathFile = path.resolve(FILE_PATH, file);

  try {
      await fs.access(pathFile);
      return res.sendFile(pathFile);
  } catch (err) {
      const message = err.code === 'ENOENT' ? 'El archivo no existe' : 'Error al solicitar el archivo.';
      return res.status(err.code === 'ENOENT' ? 404 : 500).send({ message });
  }
};

exports.deleteErrorReport = (req, res) => {
  const { id } = req.params;
  ErrorReport.findByIdAndDelete(id)
    .then(() => res.status(200).send({ message: 'Reporte eliminado exitosamente' }))
    .catch(err => res.status(500).send({ message: 'Error al eliminar el reporte de error.', error: err.message }));
};

exports.getErrorReports = (req, res) => {
  const { page = 1, pageSize = 10, type, module, category, status } = req.query;
  const query = {};

  if (category) {
    const categoriesArray = category.split(',');
    query.category = { $in: categoriesArray };
  }

  if (type) {
    const typesArray = type.split(',');
    query.type = { $in: typesArray };
  }

  if (module) {
    const modulesArray = module.split(',');
    query.module = { $in: modulesArray };
  }

  if (status) {
    const statusArray = status.split(',');
    query.status = { $in: statusArray };
  }

  ErrorReport.find(query)
    .populate('reporter', 'name surname email')
    .populate('reportedUserId', 'name surname email')
    .populate('publicationId')
    .sort({ created_at: -1 })
    .skip((page - 1) * pageSize)
    .limit(parseInt(pageSize))
    .then(reports => {
      ErrorReport.countDocuments(query).then(total => {
        // Transformar datos para compatibilidad con frontend
        const transformedReports = reports.map(report => {
          const reportObj = report.toObject();
          return {
            ...reportObj,
            reportedUser: reportObj.reportedUserId
          };
        });
        res.status(200).send({ data: transformedReports, total });
      });
    })
    .catch(err => res.status(500).send({ message: 'Error al obtener los reportes.', error: err.message }));
};
exports.updateErrorReport = async (req, res) => {
  const { id } = req.params;
  const { category, type, module, description, steps, publicationId, reportedUserId, status } = req.body;
  const update = { 
    category, 
    type, 
    module, 
    description, 
    steps,
    publicationId,
    reportedUserId,
    status
  };

  // Eliminar campos undefined
  Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);

  if (req.file) {
    update.attachment = {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fileName: req.file.filename,
      groupTitle: 'error_reports',
      created_at: new Date()
    };
  }

  try {
    console.log('Updating error report with ID:', id);
    console.log('Update data:', update);

    const updatedError = await ErrorReport.findByIdAndUpdate(id, update, { new: true });

    if (!updatedError) {
      console.log('Error report not found:', id);
      return res.status(404).send({ message: 'Reporte no encontrado' });
    }

    console.log('Successfully updated error report:', updatedError);
    res.status(200).send(updatedError);
  } catch (err) {
    console.log('Error updating error report:', err.message);
    res.status(500).send({ message: 'Error al actualizar el reporte.', error: err.message });
  }
};

// Resolver denuncia y notificar al denunciante
exports.resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { reporterId, message } = req.body;

    if (!reporterId || !message) {
      return res.status(400).send({ message: 'Faltan campos obligatorios (reporterId, message).' });
    }

    // Buscar la denuncia
    const complaint = await ErrorReport.findById(id);
    if (!complaint) {
      return res.status(404).send({ message: 'Denuncia no encontrada.' });
    }

    // Marcar como resuelta
    complaint.status = 'resolved';
    complaint.resolved_at = new Date();
    await complaint.save();

    // Obtener información del admin que resuelve
    const admin = await User.findById(req.user.sub).select('name surname');

    // Enviar notificación al denunciante
    await NotificationService.createComplaintResolvedNotification(
      admin,
      reporterId,
      complaint._id,
      message
    );

    res.status(200).send({ 
      message: 'Denuncia resuelta y notificación enviada correctamente.',
      complaint 
    });
  } catch (err) {
    console.error('Error al resolver la denuncia:', err);
    res.status(500).send({ 
      message: 'Error al resolver la denuncia.', 
      error: err.message 
    });
  }
};

// Enviar advertencia a usuario denunciado
exports.sendWarningToUser = async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).send({ message: 'Faltan campos obligatorios (userId, message).' });
    }

    // Obtener información del admin que envía la advertencia
    const admin = await User.findById(req.user.sub).select('name surname');
    if (!admin) {
      return res.status(404).send({ message: 'Administrador no encontrado.' });
    }

    // Enviar notificación de advertencia al usuario
    await NotificationService.createUserWarningNotification(
      admin,
      userId,
      message
    );

    res.status(200).send({ 
      message: 'Advertencia enviada correctamente al usuario.'
    });
  } catch (err) {
    console.error('Error al enviar advertencia:', err);
    res.status(500).send({ 
      message: 'Error al enviar la advertencia.', 
      error: err.message 
    });
  }
};


