const { uploadToCloudinary } = require('../../helpers/cloudinaryUpload');
const { itemModel, bannerHeroModel, userModel, categoryModel, brandModel } = require('../../models/index');
const cloudinary = require('cloudinary').v2;

const extractCloudinaryPublicIdFromUrl = (url = '') => {
  try {
    const cleanUrl = String(url || '').trim();
    if (!cleanUrl) return null;

    const marker = '/upload/';
    const uploadIdx = cleanUrl.indexOf(marker);
    if (uploadIdx === -1) return null;

    let path = cleanUrl.slice(uploadIdx + marker.length);
    path = path.replace(/^v\d+\//, '');

    const lastDot = path.lastIndexOf('.');
    if (lastDot > -1) path = path.slice(0, lastDot);

    return path || null;
  } catch (_) {
    return null;
  }
};

const uploadMultipleImages = async (req, res) => {
  try {
    const itemId = req.params.id;
    const files = req.files;

    // validar id
    if (!itemId) {
      return res.status(400).json({ error: 'Falta el ID del item' });
    }
     if (!itemId || itemId === "undefined") {
      console.error(itemId);
      console.error("ID de producto inválido");
      return;
    }
    
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

  console.log("REQ BODY:", req.body);
  console.log("itemId:", itemId, "typeof:", typeof itemId);
  console.log("imgUrl:", imgUrl);

  const mongoose = require("mongoose");

  if (!itemId || itemId === "undefined" || !mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ code: "400", ok: false, message: "ID de producto inválido" });
  }

  try {
    const item = await itemModel.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

    const image = item.images.find(img => img.imgUrl.trim() === imgUrl.trim());
    if (!image) return res.status(404).json({ error: 'Imagen no encontrada' });

    // 1. Eliminar de Cloudinary
    if (image.public_id) {
      const result = await cloudinary.uploader.destroy(image.public_id.trim());
      console.log("Cloudinary result:", result);
    }

    // 2. Eliminar del array
    const updatedItem = await itemModel.findByIdAndUpdate(
      itemId,
      { $pull: { images: { imgUrl: imgUrl.trim() } } },
      { new: true }
    );

    return res.json({ message: "Imagen eliminada correctamente", item: updatedItem });
  } catch (error) {
    console.error("ERROR en deleteImageFromItem:", error);
    return res.status(500).json({ error: 'Error al eliminar imagen' });
  }
};


// UPLOAD IMAGE BANNER-HERO
const uploadBannerHeroImage = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se envió una imagen' });
    }

    const result = await uploadToCloudinary(file.buffer, 'banners/hero');

    const updatedBanner = await bannerHeroModel.findByIdAndUpdate(
      id,
      { image: result.secure_url, public_id: result.public_id },
      { new: true }
    );

    res.json({
      message: 'Banner Hero actualizado correctamente',
      banner: updatedBanner
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al subir imagen del Banner Hero' });
  }
};

// UPLOAD IMAGE PERFIL
const uploadProfileImage = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se envió una imagen' });
    }

    const result = await uploadToCloudinary(file.buffer, 'profile/user');

    const updatedUserProfile = await userModel.findByIdAndUpdate(
      id,
      { profileUrl: result.secure_url, public_id: result.public_id },
      { new: true }
    );

    res.json({
      message: 'Perfil del usuario actualizado correctamente',
      user: updatedUserProfile
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al subir la imagen de perfil' });
  }
};

// UPLOAD IMAGE CATEGORY MINI-BANNER
const uploadCategoryMiniBannerImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se envió una imagen' });
    }

    const category = await categoryModel.findById(id);
    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const previousImage = Array.isArray(category.images) && category.images.length > 0
      ? category.images[0]
      : null;

    if (previousImage && previousImage.public_id) {
      await cloudinary.uploader.destroy(previousImage.public_id);
    }

    const result = await uploadToCloudinary(file.buffer, 'categories/mini-banners');

    category.images = [
      {
        title: title || (previousImage ? previousImage.title : undefined),
        description: description || (previousImage ? previousImage.description : undefined),
        imgUrl: result.secure_url,
        public_id: result.public_id
      }
    ];

    await category.save();

    res.json({
      message: 'Imagen de categoría actualizada correctamente',
      category
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al subir imagen de categoría' });
  }
};

// UPLOAD IMAGE SUBCATEGORY
const uploadSubcategoryImage = async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;
    const { title, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No se enviÃ³ una imagen" });
    }

    const category = await categoryModel.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "CategorÃ­a no encontrada" });
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({ error: "SubcategorÃ­a no encontrada" });
    }

    const previousImage =
      Array.isArray(subcategory.images) && subcategory.images.length > 0
        ? subcategory.images[0]
        : null;

    if (previousImage?.public_id) {
      await cloudinary.uploader.destroy(previousImage.public_id);
    }

    const result = await uploadToCloudinary(
      file.buffer,
      "categories/subcategories",
    );

    subcategory.images = [
      {
        title: title || (previousImage ? previousImage.title : undefined),
        description:
          description ||
          (previousImage ? previousImage.description : undefined),
        imgUrl: result.secure_url,
        public_id: result.public_id,
      },
    ];

    await category.save();

    return res.json({
      message: "Imagen de subcategorÃ­a actualizada correctamente",
      subcategory,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al subir imagen de subcategorÃ­a" });
  }
};

const deleteSubcategoryImage = async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;

    const category = await categoryModel.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "CategorÃ­a no encontrada" });
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({ error: "SubcategorÃ­a no encontrada" });
    }

    const previousImage =
      Array.isArray(subcategory.images) && subcategory.images.length > 0
        ? subcategory.images[0]
        : null;

    if (previousImage?.public_id) {
      await cloudinary.uploader.destroy(previousImage.public_id);
    }

    subcategory.images = [];
    await category.save();

    return res.json({
      message: "Imagen de subcategorÃ­a eliminada correctamente",
      subcategory,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al eliminar imagen de subcategorÃ­a" });
  }
};

// UPLOAD IMAGE BRAND LOGO
const uploadBrandLogoImage = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No se enviÃ³ una imagen" });
    }

    const brand = await brandModel.findById(id);
    if (!brand) {
      return res.status(404).json({ error: "Marca no encontrada" });
    }

    const previousPublicId =
      (brand.logoPublicId && String(brand.logoPublicId).trim()) ||
      extractCloudinaryPublicIdFromUrl(brand.logoUrl);

    if (previousPublicId) {
      await cloudinary.uploader.destroy(previousPublicId);
    }

    const result = await uploadToCloudinary(file.buffer, "brands/logos");

    brand.logoUrl = result.secure_url;
    brand.logoPublicId = result.public_id;
    await brand.save();

    res.json({
      message: "Logo de marca actualizado correctamente",
      brand
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al subir logo de marca" });
  }
};
module.exports = {
  uploadMultipleImages,
  deleteImageFromItem,
  replaceItemImage,
  uploadBannerHeroImage,
  uploadProfileImage,
  uploadCategoryMiniBannerImage,
  uploadSubcategoryImage,
  deleteSubcategoryImage,
  uploadBrandLogoImage
};
