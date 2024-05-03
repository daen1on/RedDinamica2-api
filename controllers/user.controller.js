'use strict'

// Retrieve the algorithm and key size values from environment variables
const algorithm = process.env.ALGORITHM || 'HS256'; // Use default value 'HS256' if environment variable is not set
const keySize = parseInt(process.env.KEYSIZE) || 32; // Use default value 32 if environment variable is not set or is not a valid integer

// Libraries
let bcrypt = require('bcryptjs');
let moment = require('moment');
let fs = require('fs');
let path = require('path');
const winston = require('winston');

//let uuidv4 = require('uuid/v4'); --deprecated
const { v4: uuidv4 } = require('uuid');

// Services
let jwt = require('../services/jwt.service');
let mail = require('../services/mail.service');

// Models
let User = require('../models/user.model');
let Follow = require('../models/follow.model');
let Publication = require('../models/publication.model');

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
        user.profession = params.profession;
        user.institution = params.institution;
        user.city = params.city;
        user.contactNumber = params.contactNumber;
        user.socialNetworks = params.socialNetworks;
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
                    'Nuevo usuario registrado',
                    process.env.EMAIL,
                    `
                    <h3>Hola ${process.env.NAME}</h3>
                    <p>Se ha registrado el usuario 
                    <strong>${userStored.name} ${userStored.surname}</strong>
                     con el correo electrónico 
                    ${userStored.email}.</p>
                    <p>
                    Ingresa al <strong>panel de administración</strong> de reddinámica para revisar la información 
                     del nuevo usuario.
                     </p>
                    `
                );
                delete userStored.password;
                return res.status(200).send({ user: userStored });
            }
        } catch(err) {
            return res.status(500).send({ message: 'Error in the request. The user can not be saved' });
        }
    } else {
        return res.status(200).send({ message: 'You must fill all the required fields' });
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
        return res.status(200).send({ message: 'You must fill all the required fields *****' });
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
                message: 'The email is not registered',
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
    const params = req.body;
    const password = uuidv4().substr(0, 6);

    const salt = await bcrypt.genSalt(saltR);
    const hash = await bcrypt.hash(password, salt);

    try {
        const userUpdated = await User.findOneAndUpdate({ email: params.email }, { password: hash }, { new: true }).exec();
        if (!userUpdated) return res.status(404).send({ message: 'The user can not be updated' });
        mail.sendMail(
            'Nueva contraseña Reddinámica',
            userUpdated.email,
            `
            <h3>Su contraseña de ingreso a RedDinámica se ha cambiado</h3>
            <p> Su nueva contraseña de inicio de sesión en RedDinámica es:  <strong>${password}</strong> </p>
            <p> Se recomienda cambiar la contraseña una vez se inicie sesión, esto se puede realizar ingresando a <strong>Opciones de seguridad</strong>. </p>
            `
        );
        userUpdated.password = null;
        return res.status(200).send({ user: userUpdated });
    } catch(err) {
        return res.status(500).send({ message: 'Error in the request. User has not been updated' });
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

        if (result.totalDocs === 0) {
            return res.status(404).send({ message: 'It was not found any user' });
        }

        return res.status(200).send({
            users: result.docs, // The actual users data
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
        const userUpdated = await User.findByIdAndUpdate(userId, update, { new: true })
            .populate('city')
            .populate('profession')
            .populate('institution');
        if (!userUpdated) {
            return res.status(404).send({ message: 'The user can not be updated' });
        }
        userUpdated.password = null;
        return res.status(200).send({ user: userUpdated });
    } catch (err) {
        return res.status(500).send({ message: 'Error in the request. User has not been updated' });
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
            return res.status(200).send({ message: 'The image does not exits' });
        } else {
            // en caso de otro error
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

        return {
            following: following,
            followed: followed,
            publications: publications
        }
    } catch (err) {
        return handleError(err);
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
    getNewUsers,
    getCounters,
    updateUser,
    deleteUser,
    uploadProfilePic,
    getProfilePic

}