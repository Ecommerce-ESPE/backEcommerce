const { uploadToCloudinary } = require('../helpers/cloudinaryUpload');
const {itemModel} = require('../models/index');

const uploadMultipleImages = async (req, res) => {
  try {
    const itemId = req.params.id;
    const files = req.files;

    if (!files || (!files.images && !files.banner)) {
      return res.status(400).json({ error: 'No se enviaron imágenes ni banner' });
    }

    const imageFiles = files.images || [];
    const bannerFile = files.banner ? files.banner[0] : null;

    const titles = req.body.titles || [];
    const descriptions = req.body.descriptions || [];

    const uploadedImages = await Promise.all(
      imageFiles.map(async (file, index) => {
        const result = await uploadToCloudinary(file.buffer, 'items');
        return {
          title: Array.isArray(titles) ? titles[index] : titles,
          description: Array.isArray(descriptions) ? descriptions[index] : descriptions,
          imgUrl: result.secure_url,
          public_id: result.public_id
        };
      })
    );

    // Si hay banner, súbelo a Cloudinary
    let bannerUrl = null;
    if (bannerFile) {
      const bannerResult = await uploadToCloudinary(bannerFile.buffer, 'items/banners');
      bannerUrl = bannerResult.secure_url;
    }

    const updateData = {
      ...(uploadedImages.length > 0 && { $push: { images: { $each: uploadedImages } } }),
      ...(bannerUrl && { banner: bannerUrl })
    };

    const updatedItem = await itemModel.findByIdAndUpdate(itemId, updateData, { new: true });

    res.json({
      message: 'Imágenes subidas correctamente',
      images: uploadedImages,
      banner: bannerUrl,
      item: updatedItem
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al subir imágenes' });
  }
};

// Reemplazar imagen de un item
// Reemplaza una imagen existente de un item por una nueva imagen
 
const replaceItemImage = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { imgUrl, title, description } = req.body;
    const file = req.file;

    if (!file || !imgUrl) {
      return res.status(400).json({ error: 'Faltan datos: imagen o imgUrl original' });
    }

    const item = await itemModel.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

    // Buscar imagen original
    const index = item.images.findIndex(img => img.imgUrl === imgUrl);
    if (index === -1) return res.status(404).json({ error: 'Imagen no encontrada' });

    const oldImage = item.images[index];

    // Eliminar de Cloudinary si tiene public_id
    if (oldImage.public_id) {
      await cloudinary.uploader.destroy(oldImage.public_id);
    }

    // Subir nueva imagen
    const newImage = await uploadToCloudinary(file.buffer, 'items');

    // Reemplazar la imagen en el array
    item.images[index] = {
      title: title || oldImage.title,
      description: description || oldImage.description,
      imgUrl: newImage.secure_url,
      public_id: newImage.public_id
    };

    await item.save();

    res.json({
      message: 'Imagen reemplazada con éxito',
      updatedImage: item.images[index],
      item
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al reemplazar la imagen' });
  }
};
const deleteImageFromItem = async (req, res) => {
  const { itemId, imgUrl } = req.body;

  try {
    const item = await itemModel.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

    const image = item.images.find(img => img.imgUrl === imgUrl);
    if (!image) return res.status(404).json({ error: 'Imagen no encontrada' });

    // 1. Eliminar imagen de Cloudinary si tiene public_id
    if (image.public_id) {
      await cloudinary.uploader.destroy(image.public_id);
    }

    // 2. Eliminar imagen del array en Mongo
    await itemModel.findByIdAndUpdate(
      itemId,
      { $pull: { images: { imgUrl: imgUrl } } },
      { new: true }
    );

    res.json({ message: 'Imagen eliminada correctamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
};
module.exports = {
  uploadMultipleImages,
  deleteImageFromItem,
  replaceItemImage
};