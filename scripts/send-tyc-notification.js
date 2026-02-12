'use strict';

const path = require('path');
// Carga el .env desde la raíz del proyecto
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const User = require('../models/user.model');

// Configuración de rutas para imágenes (ajusta según tu estructura de carpetas)
const imagePath = path.join(__dirname, '../client/browser/assets/images/');

async function connect() {
    const uri = `mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB}?authSource=admin`;
    console.log(`[TYC-NOTIFIER] Conectando a ${uri}`);
    await mongoose.connect(uri, { family: 4 });
}

async function sendEmail(user) {
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        tls: { rejectUnauthorized: false },
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD
        }
    });

    const tycUrl = process.env.URL + "assets/TyC_RedDinamica.pdf";
    
    const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #2C3E50; padding: 20px; text-align: center;">
            <img src="cid:logo" alt="RedDinámica" style="width: 60px; height: auto;">
            <h1 style="color: white; margin: 10px 0 0 0; font-size: 24px;">RedDinámica</h1>
        </div>
        <div style="padding: 30px; color: #333;">
            <h2 style="color: #2C3E50;">Actualización de Términos y Condiciones</h2>
            <p>Hola <strong>${user.name} ${user.surname}</strong>,</p>
            <p>Te informamos que el documento de <strong>Términos y Condiciones de Uso</strong> de la plataforma ha sido actualizado para mejorar nuestra comunidad.</p>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #18BC9C; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;">Puedes consultar el documento actualizado aquí:</p>
                <a href="${tycUrl}" style="color: #18BC9C; font-weight: bold; text-decoration: none;">📄 TyC_RedDinamica.pdf</a>
            </div>

            <p style="font-size: 14px; color: #555;">
                <strong>Nota:</strong> Si tienes alguna inconformidad con los nuevos términos, por favor responde directamente a este correo. De lo contrario, entenderemos que estás de acuerdo con los cambios al continuar usando el sistema.
            </p>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #7f8c8d;">
            &copy; 2026 RedDinámica - Universidad Industrial de Santander
        </div>
    </div>
    `;

    return transporter.sendMail({
        from: `RedDinámica <${process.env.EMAIL_HOST_USER || process.env.EMAIL}>`,
        to: user.email,
        subject: "⚠️ IMPORTANTE: Actualización de Términos y Condiciones - RedDinámica",
        html: htmlContent,
        attachments: [
            {
                filename: 'RDLogo.png',
                path: path.join(imagePath, 'RDLogo.png'),
                cid: 'logo' // mismo ID que en el <img> src
            }
        ]
    });
}

async function run() {
    try {
        await connect();
        const users = await User.find({ actived: true, email: { $exists: true, $ne: '' } })
                               .select('name surname email').lean();

        console.log(`🚀 Iniciando envío a ${users.length} usuarios...`);

        for (let i = 0; i < users.length; i++) {
            try {
                await sendEmail(users[i]);
                console.log(`[${i + 1}/${users.length}] ✓ Enviado: ${users[i].email}`);
            } catch (err) {
                console.error(`[${i + 1}/${users.length}] ✗ Error en ${users[i].email}:`, err.message);
            }
            // Delay de 2 segundos para cumplir con la política de seguridad UIS
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (error) {
        console.error('Error crítico:', error);
    } finally {
        mongoose.disconnect();
        process.exit(0);
    }
}

run();