const {userModel} = require('../models/index');


const getUserAll = async (req,res)=>{
    const {body} = req;
    const data = await userModel.find({});
    
    res.json({
        msg:"Succesfull",
        user: data
    })
}

const createUser = async (req,res)=>{
    const {body} = req;
    const data = await userModel.create(body);

    res.json({
        msg:"Succesfull",
        user: data
    })
}

module.exports = {
    createUser, 
    getUserAll
}