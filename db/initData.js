'use strict'
let moment = require('moment');
let bcrypt = require('bcryptjs');

let User = require('../models/user.model');

// Función para crear administrador (convertida a async/await)
exports.createAdmin = async function(){
    try {
        const user = new User();
        user.name = process.env.NAME || 'RedDinámica';
        user.surname = process.env.SURNAME || '';
        user.password = process.env.PASSWORD;
        user.email = process.env.EMAIL;
        user.role = 'admin';
        user.actived = true;
        user.about = 'Cuenta administrador de RedDinámica';
        user.created_at = moment().unix();

        // Check duplicate users - usando promesas
        const users = await User.find({ $or: [{ email: user.email }, { role: 'admin' }] });

        if (users && users.length >= 1) {
            return console.log('The administrator is already created.');
        }

        // Hash password usando promesas
        const saltR = 10;
        const salt = await bcrypt.genSalt(saltR);
        const hash = await bcrypt.hash(user.password, salt);
        user.password = hash;

        // Guardar usuario
        const userStored = await user.save();
        
        if (!userStored) {
            console.log('The admin has not been saved');
        } else {
            console.log('The admin was created correctly');
        }
    } catch (err) {
        console.log('Error in the request. The admin can not be created:', err.message);
    }
}

// Crear o actualizar usuario seed con rol lesson_manager (convertida a async/await)
exports.createLessonManager = async function(){
    try {
        const email = process.env.SEED_LESSON_MANAGER_EMAIL || 'lesson.manager@example.com';
        const password = process.env.SEED_LESSON_MANAGER_PASSWORD || 'changeme';
        const saltR = 10;

        // Buscar si ya existe - usando promesas
        const existing = await User.findOne({ email });

        if (existing) {
            if (existing.role !== 'lesson_manager') {
                existing.role = 'lesson_manager';
                existing.actived = true;
                await existing.save();
                console.log('Actualizado role a lesson_manager:', email);
            } else {
                console.log('Usuario lesson_manager seed ya existe:', email);
            }
            return;
        }

        // Crear nuevo usuario
        let user = new User();
        user.name = 'Lesson';
        user.surname = 'Manager';
        user.email = email;
        user.role = 'lesson_manager';
        user.actived = true;
        user.created_at = moment().unix();

        // Hash password usando promesas
        const salt = await bcrypt.genSalt(saltR);
        const hash = await bcrypt.hash(password, salt);
        user.password = hash;

        // Guardar usuario
        await user.save();
        console.log('Creado usuario lesson_manager seed:', email);
    } catch (err) {
        console.log('Error con lesson_manager seed:', err.message);
    }
}