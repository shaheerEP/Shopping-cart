var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const adminHelpers = require('../helpers/admin-helpers');
const mongoose = require('mongoose');
var hbs = require('handlebars');
const {Order,User} = require('../helpers/schema')
const productHelpers = require('../helpers/product-helpers');
var handlebars = require('handlebars');

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

router.get('/', verifyLoggin,function(req, res, next) {
  productHelpers.getAllProducts().then((allproducts) => {
   
allproducts.forEach(product => {
  
    product.imageType = 'file';
    
});

    const products = allproducts.map((product, index) => ({
      _id :product._id,
      name: product.name,
      category: product.category,
      description: product.description,
      image: product.image,
      price: product.price,
      index: index + 1 
    }));

    
res.render('admin/view-products', {admin: true, allproducts: products});
}).catch((error) => {console.error('Error fetching products:', error);});
    });


router.get('/add-product',verifyLoggin, function(req, res, next) {

  res.render('admin/add-product', {admin: true});
})

router.post('/add-product', verifyLoggin, (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
      req.flash('error', 'No files were uploaded.');
      return res.redirect('/add-product');
  }
  let image = req.files.image;
  let uploadDir = './public/product-images/';
  let timestamp = Date.now();
  let imageName = timestamp + '_' + image.name;

  image.mv(uploadDir + imageName, function(err) {
      if (err) {
          console.error("Error uploading image:", err); // Log the error for analysis
          req.flash('error', 'There was a problem uploading the product image.');
          return res.redirect('/add-product'); 
      } 

      req.body.image = imageName;
      productHelpers.addProduct(req.body) 
          .then(() => {
              res.redirect('/admin'); 
          })
          .catch(err => {
              console.error("Error adding product to database:", err);
              req.flash('error', 'There was a problem saving the product.');
              res.redirect('/add-product');
          });
  });
});


router.get('/delete-product/:id',verifyLoggin,(req,res)=>{
  let prodId = req.params.id
  console.log(prodId);
  productHelpers.deleteProduct(prodId);
  res.redirect('/admin', {admin: true});
});
 
router.get('/edit-product/:id', verifyLoggin, async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await productHelpers.getProductDetails(productId);

    if (!product) {
      return res.status(404).send('Product not found'); // Handle non-existent product
    }

    // Merge product and {admin: true} into a single object
    const viewData = Object.assign({}, product, {admin: true});

    res.render('admin/edit-product', viewData); // Render template with product data
    console.log(product)
  } catch (error) { 
    console.error(error);
    res.status(500).send('Internal server error'); // Handle errors gracefully
  }
});


router.post('/edit-product/:id',verifyLoggin,(req,res)=>{
  console.log(req.params.id,req.body)
  let productDetails = req.body;
  if(req.files && req.files.image){
    let image = req.files.image;
    let uploadDir = './public/product-images/';
    let timestamp = Date.now();
    let imageName = timestamp + '_' + image.name;
  
    image.mv(uploadDir + imageName, function(err) {
      if (err)
        return res.status(500).send(err);
      productDetails.image = imageName;
      productHelpers.updateProduct(req.params.id, productDetails).then(()=>{
        res.redirect('/admin')
      });
    });
  } else {
    productHelpers.updateProduct(req.params.id, productDetails).then(()=>{ 
      res.redirect('/admin')
    });
  }
})




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
