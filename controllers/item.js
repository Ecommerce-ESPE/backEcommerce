const {itemModel} = require('../models/index');

// @GET ALL ITEMS
const getItemsAll = async (req,res)=>{
    const {body} = req;
    const data = await itemModel.find().populate("createdBy",'name email')
    res.json({
        code:"200",
        ok:true,
        items:data
    });
}


const getItemsById = async (req,res)=>{
    try {
        const {id} = req.params;
        const data = await itemModel.findById(id).populate();
        res.json({
            code:"200",
            ok:true,
            items:data
        });

        console.log(id)
    } catch (error) {
        console.log(error)
    }
}


const createItem = async (req,res)=>{
    const {body} = req;
    const data = await itemModel.create(body);
    res.json({
        code:"200",
        ok:true,
        item:data
    })
}

module.exports = {
    createItem, 
    getItemsAll,
    getItemsById
}