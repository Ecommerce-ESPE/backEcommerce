const { Router } = require('express');
const upload = require('../middlewares/upload');
const {
  uploadMultipleImages,
  deleteImageFromItem,
  replaceItemImage,
  uploadBannerHeroImage,
  uploadProfileImage
} = require('../controllers/uploads');

const router = Router();

// Items: images + banner
router.put(
  '/items/:id/images',
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'banner', maxCount: 1 }
  ]),
  uploadMultipleImages
);

// Items: delete image
router.post('/items/image/delete', deleteImageFromItem);

// Items: replace image
router.put('/items/:itemId/image/replace', upload.single('image'), replaceItemImage);

// Banner hero image
router.put('/banner-hero/:id/image', upload.single('image'), uploadBannerHeroImage);

// User profile image
router.put('/profile/:id/image', upload.single('image'), uploadProfileImage);

module.exports = router;