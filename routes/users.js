
const productHelper = require('../helpers/product-helpers');
const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const router = express.Router();
const userHelpers = require('../helpers/user-helpers');
const {Order,User} = require('../helpers/schema') 
 
// let User; 
// try {
//   User = mongoose.model('User');
// } catch {
//   User = mongoose.model('User', new mongoose.Schema({
//     name: String,
//     email: String,
//     password: String
//   }));
// }

const verifyLoggin = (req,res,next)=> {
  
  if(req.session.userLoggedin){
    
    next()
  }else{
    res.redirect('/login') 
  }
}
router.get('/verify-login', verifyLoggin, function(req, res) {
  res.json({ loggedIn: true });  
});



router.get('/', async function(req, res, next) {
  let user = req.session.user
  console.log(user)
  var totalQuantity = 0;
  if(req.session.user){
    totalQuantity = await userHelpers.getCartCount(req.session.user.id);
  }

  productHelper.getAllProducts().then((allproducts) => { 
    const products = allproducts.map(product => ({
      _id:product._id,
      name: product.name,
      category: product.category,
      description: product.description,
      image: product.image,
      price: product.price,
    }));
    res.render('user/view-products', {admin: false, allproducts: products, status: req.status,user, totalQuantity});
  }).catch((error) => {
    console.error('Error fetching products:', error); 
  });
});

 
router.get('/signup',(req,res)=>{
      res.render('user/signup')
});
  
router.post('/signup', async (req, res) => {
  console.log(req.body)
  try {
      const { name, email, password, confirmPassword } = req.body;

      // Check if password and confirmPassword are the same
      if (password !== confirmPassword) {
          return res.status(400).send({ message: 'Passwords do not match' });
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Save the user data to your database
      const user = new User({ name, email, password: hashedPassword });
     console.log(user)
      await user.save();

      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email
      };
      
     req.session.userLoggedin = true;
      // Then redirect to '/'
      res.redirect('/');
  } catch (error) {
      res.status(500).send({ message: 'An error occurred' });
  }
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Find the user by email 
  const user = await User.findOne({ email });

  // If user not found, redirect to '/login'
  if (!user) {
    req.session.loginErr = true;
    return res.redirect('/login'); 
  }

  // Check the password
  const validPassword = await bcrypt.compare(password, user.password);

  // If password is not valid, redirect to '/login'
  if (!validPassword) {
    req.session.loginErr = true;
    return res.redirect('/login');
  }

  // If everything is ok, store user data in the session
  req.session.user = {
    id: user._id,
    name: user.name,
    email: user.email
  };
  
 req.session.userLoggedin = true;
  // Then redirect to '/'
  res.redirect('/');
}); 


router.get('/logout', (req, res) => { 
  req.session.destroy((err) => { 
    if (err) {   
      console.error(err);
      return res.status(500).send('Error logging out');
    }
    res.redirect('/'); 
  });
});


router.get('/login', (req, res) => {
  // If user is logged in, redirect to '/'
  if (req.session.user) {
    return res.redirect('/');
  }

  // If user is not logged in, render the login page
  let loginErr = req.session.loginErr;
  req.session.loginErr = false; // Reset the flag
  res.render('user/login', { "loginErr": loginErr });
});
router.get('/verifyLogin', verifyLoggin, (req, res) => {
  res.sendStatus(200); // Send a success status if the user is logged in
});

router.get('/cart', verifyLoggin, async (req, res) => {
  var totalAmount = await userHelpers.getCartTotal(req.session.user.id); 
  var products = await userHelpers.getCartProducts(req.session.user.id);
  var totalQuantity = await userHelpers.getCartCount(req.session.user.id)
console.log(totalAmount)
  res.render('user/cart', { products,user:req.session.user,totalQuantity,totalAmount}); 
});

router.get('/add-to-cart/:id', verifyLoggin, async (req, res) => {
  try {
    let totalQuantity = await userHelpers.addToCart(req.params.id, req.session.user.id);
    res.json({ totalQuantity });
  } catch (error) {
    res.status(500).send(error);
  }
}); 

router.post('/update-cart', verifyLoggin, async (req, res) => {
  try {
    let newQuantity = await userHelpers.updateCart(req.body.id, req.session.user.id, req.body.action);
    
    res.json({ newQuantity });
  } catch (error) {
    res.status(500).send(error);  
  }
});

router.post('/remove-from-cart/:id', verifyLoggin, async (req, res) => {
  try {
    let { removedQuantity, removedPrice } = await userHelpers.removeFromcart(req.params.id, req.session.user.id);
    res.json({ removedQuantity, removedPrice });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).send(error);
  }
});

router.get('/get-cart-total', verifyLoggin, async (req, res) => {
  try {
    let totalAmount = await userHelpers.getCartTotal(req.session.user.id);
    res.json({ totalAmount });
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get('/place-order',verifyLoggin,async function(req, res, next) {
  var totalAmount = await userHelpers.getCartTotal(req.session.user.id);
  console.log(req.session.user)
  res.render('user/place-order',{totalAmount,user:req.session.user});
})
router.get('/order-success',verifyLoggin,async function(req, res, next) {
  await userHelpers.removeFromCart(req.session.user.id); 
  
  res.render('user/order-success',{user:req.session.user});
})
router.get('/orders', verifyLoggin, async function(req, res, next) {
  try {
    
    var orders = await userHelpers.getOrdersByUserId(req.session.user.id);
    if (orders) {
      const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
      orders = orders.map(order => {
        order.submittedAt = order.submittedAt.toLocaleString("en-IN", options);
        return order;
      });
       
      console.log(orders);
      res.render('user/orders', {  orders,user:req.session.user });
    }
  } catch (error) {
    console.error(error); 
    next(error);
  }
});

router.get('/online-payment',verifyLoggin,async function(req, res, next) {
  var totalAmount = await userHelpers.getCartTotal(req.session.user.id);
  res.render('user/online-payment',{totalAmount,user:req.session.user});
})
router.post('/orders', verifyLoggin, async (req, res) => {
  try {
    var totalAmount = await userHelpers.getCartTotal(req.session.user.id);
    var prod = await userHelpers.getCartProducts(req.session.user.id);

    var orderInstance = new Order({
      deliveryDetails: {
        mobile: req.body.mobile,
        pincode: req.body.pincode,
        address: req.body.address
      },
      totalAmount: totalAmount,
      userId: req.session.user.id,
      products: prod,
      payment_method: req.body.payment_method,
      status: req.body.payment_method === 'cod' ? 'placed' : 'pending' // Set status based on payment method
    });

    // Save the order in the database
    await orderInstance.save();

    // Get the _id of the new order 
    var orderId = orderInstance._id;
    
  
    // Redirect the user based on the payment method
    if (req.body.payment_method === 'cod') {
      res.redirect('/order-success');
    } else {
      userHelpers.generateRazorpay(orderId,totalAmount, req.session.user).then((order)=>
      {
        console.log("New Order :", order);
        res.json(order); // Return the order details as a JSON response
      })
    } 
  } catch (error) {
    console.error(error); 
    res.status(500).send(error);
  }
});




router.get('/ordered-products', verifyLoggin, async function(req, res, next) {
  

  var orders = await userHelpers.getOrdersByOrderId(req.query.id);
  res.render('user/ordered-products', {orders, user: req.session.user});
});


router.post('/verify-payment', (req, res) => {
  console.log(req.body)
  if (userHelpers.verifySignature(req.body)) {
    
    userHelpers.updateStatus(req.body.order.receipt, 'paid') // Update status to 'paid' on successful payment

    console.log('Payment is successful');
    res.json({ status: 'success', redirect: '/order-success' }); // Add a redirect field to the response
  } else {
    // Payment is not successful
    console.log('Payment is not successful');
    res.json({ status: 'error' });
  }
});



module.exports = router;


