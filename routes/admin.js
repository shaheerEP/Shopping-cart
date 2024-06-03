var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const adminHelpers = require('../helpers/admin-helpers');
const mongoose = require('mongoose');
var hbs = require('handlebars');
const {Order,User} = require('../helpers/schema')
const productHelpers = require('../helpers/product-helpers');
var handlebars = require('handlebars');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

handlebars.registerHelper('formatDateToIST', function(dateString) {
  var date = new Date(dateString);
  var options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Asia/Kolkata' };
  return date.toLocaleString("en-US", options);
});


hbs.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

let Admin;
try {
  Admin = mongoose.model('Admin');
} catch {
  Admin = mongoose.model('Admin', new mongoose.Schema({
    name: String,
    email: String,
    password: String
  }));
}

const verifyLoggin = (req,res,next)=> {
  
  if(req.session.adminLoggedin){
    
    next()
  }else{
    res.redirect('/admin/login')
  }
}

/* GET users listing. */
router.get('/logout', (req, res) => {
  req.session.admin=null
  req.session.adminLoggedin=false
  res.redirect('/')
})
router.get('/login', (req, res) => {
  // If user is logged in, redirect to '/'
  if (req.session.admin) {
    return res.redirect('/admin');
  }

  // If user is not logged in, render the login page
  let adminLoginErr = req.session.adminLoginErr;
  req.session.adminLoginErr = false; // Reset the flag
  res.render('admin/login', { "adminLoginErr": adminLoginErr ,admin: true});
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  
  const admin = await Admin.findOne({ email });

 
  if (!admin) {
    req.session.adminLoginErr = true;
    return res.redirect('/admin/login');
  }

  // Check the password
  const validPassword = await bcrypt.compare(password, admin.password);

  // If password is not valid, redirect to '/login'
  if (!validPassword) {
    req.session.adminLoginErr = true;
    return res.redirect('admin/login');
  }

  // If everything is ok, store user data in the session
  req.session.admin = {
    id: admin._id,
    name: admin.name,
    email: admin.email
  };
  
 req.session.adminLoggedin = true;
  // Then redirect to '/'
  res.redirect('/admin');
});

router.get('/', verifyLoggin, function(req, res, next) {
  productHelpers.getAllProducts().then((allproducts) => {
   
    allproducts.forEach(product => {
      // Add a flag to indicate Cloudinary image
      product.isCloudinaryImage = product.image.startsWith('https://'); 
    });

    const products = allproducts.map((product, index) => ({
      _id :product._id,
      name: product.name,
      category: product.category,
      description: product.description,
      image: product.image,
      price: product.price,
      index: index + 1,
      isCloudinaryImage: product.isCloudinaryImage // Include the flag in the mapped object
    }));

    res.render('admin/view-products', { admin: true, allproducts: products });
  }).catch((error) => {
    console.error('Error fetching products:', error);
  });
});



router.get('/add-product',verifyLoggin, function(req, res, next) {

  res.render('admin/add-product', {admin: true});
})

router.post('/add-product', verifyLoggin, async (req, res) => {
  try {
    let productDetails = req.body;
    
    if (req.files && req.files.image) {
      let image = req.files.image;

      cloudinary.uploader.upload(image.tempFilePath, async (err, result) => {
        if (err) return res.status(500).send(err);

        productDetails.image = result.secure_url;
        await productHelpers.addProduct(productDetails);
        res.redirect('/admin');
      });
    } else {
      return res.status(400).send('Image is required');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});


router.get('/edit-product/:id', verifyLoggin, async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await productHelpers.getProductDetails(productId);

    if (!product) {
      return res.status(404).send('Product not found');
    }

    const viewData = Object.assign({}, product._doc, {admin: true});
    console.log(viewData, "hai");
    res.render('admin/edit-product', viewData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});


router.post('/edit-product/:id', verifyLoggin, async (req, res) => {
  try {
    const productId = req.params.id;
    const oldProductDetails = await productHelpers.getProductDetails(productId);
    let productDetails = req.body;

    if (req.files && req.files.image) {
      let image = req.files.image;
      let timestamp = Date.now();
      let imageName = timestamp + '_' + image.name;

      // Check if the old image is in local storage and delete it
      if (oldProductDetails.image && !oldProductDetails.image.startsWith('http')) {
        let oldImagePath = path.join(__dirname, 'public', 'product-images', oldProductDetails.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Upload new image to Cloudinary
      cloudinary.uploader.upload(image.tempFilePath, { public_id: imageName }, (err, result) => {
        if (err) return res.status(500).send(err);

        productDetails.image = result.secure_url;
        productHelpers.updateProduct(productId, productDetails).then(() => {
          res.redirect('/admin');
        });
      });
    } else {
      productHelpers.updateProduct(productId, productDetails).then(() => {
        res.redirect('/admin');
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});




router.get('/delete-product/:id', verifyLoggin, async (req, res) => {
  try {
    const prodId = req.params.id;

    if (!req.session.adminLoggedin) {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    // Fetch the product details (including the image URL) from the database
    const product = await productHelpers.getProductDetails(prodId);
    console.log('Fetched product details:', product);

    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/admin');
    }
    console.log('Delete product route hit, id:', prodId);

    // Delete product from the database
    await productHelpers.deleteProduct(prodId);

    // Delete the image from the local file system
    fs.unlink(path.join(__dirname, '/public/product-images', product.image), (error) => {
      if (error) {
        console.error('Error deleting image from local file system:', error);
        req.flash('error', 'Error deleting image from local file system'); // Add flash message for error
      } else {
        console.log('Image deleted from local file system');
        req.flash('success', 'Product and image deleted successfully'); // Add flash message for success
      }

      res.redirect('/admin');
    });

  } catch (error) {
    console.error('Error in delete-product route:', error);
    req.flash('error', 'Error deleting product'); // General error message for other errors
    res.redirect('/admin');
  }
});


router.get('/edit-product/:id', verifyLoggin, async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await productHelpers.getProductDetails(productId);

    if (!product) {
      return res.status(404).send('Product not found');
    }

    const viewData = Object.assign({}, product._doc, {admin: true});
    console.log(viewData, "hai");
    res.render('admin/edit-product', viewData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});



router.post('/edit-product/:id', verifyLoggin, (req, res) => {
  console.log(req.params.id, req.body);
  let productDetails = req.body;

  if (req.files && req.files.image) {
    let image = req.files.image;
    let uploadDir = './public/product-images/';
    let timestamp = Date.now();
    let imageName = timestamp + '_' + image.name;

    image.mv(uploadDir + imageName, function(err) {
      if (err) return res.status(500).send(err);
      productDetails.image = imageName;
      productHelpers.updateProduct(req.params.id, productDetails).then(() => {
        console.log("hai...");
        res.redirect('/admin');
      });
    });
  } else {
    productHelpers.updateProduct(req.params.id, productDetails).then(() => {
      res.redirect('/admin');
    });
  }
});





router.get('/orders', verifyLoggin, async (req, res) => {
  try {
      const orders = await Order.aggregate([
          { $match: { status: { $in: ['placed', 'paid'] } } },
          {
              $lookup: {
                  from: 'users', // name of the users collection
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'user'
              }
          },
          {
              $unwind: '$user'
          }
      ]);

      // Add a flag to indicate Cloudinary image
      orders.forEach(order => {
        order.products.forEach(product => {
          product.isCloudinaryImage = product.image.startsWith('https://');
        });
      });

      res.render('admin/orders', { admin: true, orders: orders }, function(err, html) {
          if (err) {
              // handle error
              console.log(err);
          } else {
              res.send(html);
          }
      });
  } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
  }
});


router.get('/users', verifyLoggin, async (req, res) => {
  let users = await adminHelpers.getAllUsers(); 
  console.log(users)
  res.render('admin/users',{ users: users, admin: true }) 
})

router.get('/orders/details/:userId', verifyLoggin, async (req, res) => {
  try {
      const user = await User.findById(req.params.userId);
      const paidOrders = await Order.find({ userId: req.params.userId, status: 'paid' });
      const placedOrders = await Order.find({ userId: req.params.userId, status: 'placed' });
   
      res.render('admin/order-details', { user: user, paidOrders: paidOrders, placedOrders: placedOrders ,admin: true,userName: user.name}, function(err, html) {
          if (err) {
              // handle error
              console.log(err);
          } else {
              res.send(html);
          }
      });
  } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
  }
});

router.get('/orders/print/:orderId', verifyLoggin, async (req, res) => {
  try {
      const order = await Order.findById(req.params.orderId);
      const user = await User.findById(order.userId);
      res.render('admin/print-order', { user: user, order: order,admin: true});
  } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
  }
});


module.exports = router;
