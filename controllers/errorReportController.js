const fs = require('fs').promises;
const path = require('path');
const ErrorReport = require('../models/errorReport.model');
const FILE_PATH = path.join(__dirname, '../uploads/errors/');

exports.createErrorReport = (req, res) => {
  const { type, module, description, steps } = req.body;
  const attachment = req.file ? {
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    fileName: req.file.filename,
    groupTitle: 'error_reports',
    created_at: new Date()
  } : null;

  const errorReport = new ErrorReport({
    type,
    module,
    description,
    steps,
    attachment
  });

  errorReport.save()
    .then(report => res.status(201).send(report))
    .catch(err => res.status(500).send({ message: 'Error al guardar el reporte de error.', error: err.message }));
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
  const { page = 1, pageSize = 10, type, module } = req.query;
  const query = {};

  if (type) {
    const typesArray = type.split(',');
    query.type = { $in: typesArray };
  }

  if (module) {
    const modulesArray = module.split(',');
    query.module = { $in: modulesArray };
  }

  ErrorReport.find(query)
    .skip((page - 1) * pageSize)
    .limit(parseInt(pageSize))
    .then(reports => {
      ErrorReport.countDocuments(query).then(total => {
        res.status(200).send({ data: reports, total });
      });
    })
    .catch(err => res.status(500).send({ message: 'Error al obtener los reportes de error.', error: err.message }));
};
exports.updateErrorReport = async (req, res) => {
  const { id } = req.params;
  const { type, module, description, steps } = req.body;
  const update = { type, module, description, steps };

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
      return res.status(404).send({ message: 'Reporte de error no encontrado' });
    }

    console.log('Successfully updated error report:', updatedError);
    res.status(200).send(updatedError);
  } catch (err) {
    console.log('Error updating error report:', err.message);
    res.status(500).send({ message: 'Error al actualizar el reporte de error.', error: err.message });
  }
};


