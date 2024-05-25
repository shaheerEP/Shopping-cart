const mongoose = require('mongoose');


 

 let User = mongoose.model('User', new mongoose.Schema({ 
    name: String,
    email: String,
    password: String
  }));  


const OrderSchema = new mongoose.Schema({
  deliveryDetails: {
    mobile: { 
      type: String,
      required: true
    },
    pincode: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      required: true
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User' // Assuming 'User' is your User model
  },
  products: {
    type: Array,
    required: true
  },
  payment_method: {
    type: String,
    required: true
  },
  submittedAt: { 
    type: Date,
    default: Date.now // Store the date as a Date object
  },
  totalAmount:{
    type: Number,
    required:true
  },
  status: {
    type: String,
    
}});


const Order = mongoose.model('Order', OrderSchema);



 module.exports = 
  {Order,User}
;
