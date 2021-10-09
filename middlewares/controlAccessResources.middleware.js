'use strict'
let Resource = require('../models/resource.model');

exports.isAdmin = function(req, res, next){
    let resourceId = req.params.id;
    
    //console.log("resId",resourceId);
    
    
    if(req.user.role == 'admin' || req.user.role == 'delegated_admin'){
        next();
    }else{
       
       Resource.findOne({author: req.user.sub, _id: resourceId }, (err, resource) => {
           if (err) return res.status(500).send({ message: 'Error in the request. It can not be removed the resource' });
           if (resource){
            if(resource.file==null) {   
                
                next();
                }
            else{
                res.status(403).send({message:'The user might not have the necessary permissions for a resource'})
            }    
            }
           else{
                res.status(403).send({message:'The user might not have the necessary permissions for a resource'})
            }
       });
    }
};
