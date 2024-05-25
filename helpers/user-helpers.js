const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { Schema } = mongoose;
const {Order,User} = require('../helpers/schema')
const Razorpay = require('razorpay');
const crypto = require('crypto');

var instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});
const {  Product,
  addProduct,
  getAllProducts,
  deleteProduct,
  getProductDetails,
  updateProduct } = require('./product-helpers');

  
// Assuming you have a User model defined like this:
// const Cart = mongoose.model('Cart', new mongoose.Schema({
//   userId: String,
//   products: [String]
   
// }));
const ProductSchema = new Schema({
  productId: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  }
});

const CartSchema = new Schema({
  userId: {
    type: String,
    required: true
  },
  products: [ProductSchema]
});

const Cart = mongoose.model('Cart', CartSchema);

module.exports = {
  async addToCart(prodId, userId) {
    try {
      let cart = await Cart.findOne({ userId });
      let totalQuantity = 0;
      if (!cart) {
        // Create a new cart for the user with the product id and quantity set to 1
        cart = await Cart.create({ userId, products: [{ productId: prodId, quantity: 1 }] });
        totalQuantity = 1;
      } else {
        // Find the product in the cart
        let product = cart.products.find(p => p.productId === prodId);
        if (product) {
          // If the product is already in the cart, increase the quantity
          product.quantity += 1;
        } else {
          // If the product is not in the cart, add it with quantity set to 1
          cart.products.push({ productId: prodId, quantity: 1 });
        }
        // Calculate the total quantity of products in the cart
        totalQuantity = cart.products.reduce((total, product) => total + product.quantity, 0);
      }
      await cart.save();
      console.log('Product added to cart successfully!');
      return totalQuantity;
    } catch (error) {
      console.error('Error adding product to cart:', error);
    }
  }
  
  
  ,

  async getCartProducts(userId) {
    try {
      const cart = await Cart.findOne({ userId: userId });
      if (!cart) {
        return [];
      }
  
      // Map the product ids to their details and quantities
      const products = await Promise.all(cart.products.map(async (p) => {
        const product = await Product.findById(p.productId);
        return {
          ...product._doc,
          quantity: p.quantity
        };
      }));
  
      return products;
    } catch (err) {
      console.error(err);
      return [];
    }
  }
  ,async quantityOfOrderedProducts(userId) {
  try {
    const pipeline = [
      {
        $match: {
          userId: userId
        }
      },
      {
        $unwind: '$products'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $group: {
          _id: '$productDetails._id',
          quantity: { $sum: 1 },
          productName: { $first: '$productDetails.name' }
        }
      },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: '$productName',
          quantity: '$quantity'
        }
      }
    ];

    const results = await Cart.aggregate(pipeline);
    return results;
  } catch (err) {
    console.error('Error fetching order quantities:', err);
    // You can throw a custom error here for handling in your application logic
    // throw new Error('Failed to get order quantities');
  }
},
async getCartCount(userId) {
  const cart = await Cart.findOne({ userId: userId });
  if (!cart) {
    return 0;
  }

  // Calculate the total quantity of products in the cart
  var totalQuantity = cart.products.reduce((total, product) => total + product.quantity, 0);
  return totalQuantity;
},
async updateCart(prodId, userId, action) {
  let cart = await Cart.findOne({ userId });
  let product = cart.products.find(p => p.productId === prodId);
  if (action === 'increase') {
    product.quantity += 1;
  } else if (action === 'decrease' && product.quantity > 0) {
    product.quantity -= 1;
  }
  await cart.save();
  return product.quantity;
}
,
async removeFromCart(userId) {
  try {
    await Cart.deleteOne({ userId: userId });
    console.log('Cart removed successfully!');
  } catch (error) {
    console.error('Error removing cart:', error);
  }
}
,async removeFromcart(prodId, userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    throw new Error('Cart not found for user');
  }

  let product = cart.products.find(p => p.productId === prodId);
  if (!product) {
    throw new Error('Product not found in cart');
  }

  let removedQuantity = product.quantity;
  let productDetails = await Product.findById(prodId);
  if (!productDetails) {
    throw new Error('Product details not found');
  }

  let removedPrice = Number(productDetails.price);

  // Remove the product from the cart
  cart.products = cart.products.filter(p => p.productId !== prodId);
  await cart.save();

  return { removedQuantity, removedPrice };
}


,async getCartTotal(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    return 0;
  }  

  let total = 0;
  for (let product of cart.products) {
    let productDetails = await Product.findById(product.productId);
    let price = productDetails.price; // assuming price is already a number

    total += product.quantity * price;
  }
  return total;
}
,
async getOrdersByUserId(userId) {
  try {
    const orders = await Order.find({ 
      userId: userId, 
      status: { $ne: 'pending' },
      // Filter products where quantity is greater than 0
      'products.quantity': { $gt: 0 } 
    });

    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
    return orders.map(order => {
      const orderObject = order.toObject();
      orderObject.submittedAt = orderObject.submittedAt.toLocaleString("en-IN", options);
      return orderObject;
    });
  } catch (error) {
    console.error(error);
    return null; 
  }
}, 

async getOrdersByOrderId(orderId) {
  try {
    const order = await Order.findOne({ _id: orderId }); 

    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };

    if (order) {
      const orderObject = order.toObject();
      orderObject.submittedAt = orderObject.submittedAt.toLocaleString("en-IN", options);

      // Filter the products array to keep only those with quantity > 0 
      orderObject.products = orderObject.products.filter(product => product.quantity > 0);

      return orderObject;
    }
    return null;
  } catch (error) {
    console.error(error);
    throw error; 
  }
}

,
async generateRazorpay(orderId, totalAmount,user) {
  var options = {
    amount: totalAmount * 100, // amount in the smallest currency unit
    currency: "INR",
    receipt: orderId.toString(),
    payment_capture: '0',
    notes: {
      name: user.name, // Use the user's name
      email: user.email, // Use the user's email
    }
  };
  return new Promise((resolve, reject) => {
    instance.orders.create(options, function(err, order) {
      if(err) {
        reject(err);
      } else {
        resolve(order);
      }
    });
  });
}
,
verifySignature(reqBody) {
  var key_secret = process.env.RAZORPAY_SECRET; // Use your secret key here

  var generated_signature = crypto.createHmac('sha256', key_secret)
    .update(reqBody.order.id+ '|' + reqBody.payment.razorpay_payment_id)
    .digest('hex');

  return generated_signature === reqBody.payment.razorpay_signature;
},
async updateStatus(orderId, status) {
  try {
    await Order.updateOne({ _id: orderId }, { status: status }); // Update status based on the provided status
    console.log('Order status updated successfully');
    
  } catch (error) {
    console.error('Error updating order status:', error);
  }



}
}





