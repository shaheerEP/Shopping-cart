const mongoose = require('mongoose');
const {Order,User} = require('../helpers/schema')

module.exports = {

    async getAllOrders(){
        try {
          const orders = await Order.find({});
          
          return orders;
        } catch (error) {
          console.error('Error fetching products:', error);
        }
      }
,
async getAllUsers(){
    try {
      const users = await User.find({});
      
      return users;
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }
}
