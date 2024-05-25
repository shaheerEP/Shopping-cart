const mongoose = require('mongoose');

// Replace with your MongoDB Atlas connection string
const connectionString = process.env.DATABASE_URL;

const Product = mongoose.model('Product');
mongoose.connect(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(error => console.error('Error connecting to MongoDB:', error));

const deleteProduct = async (prodId) => {
    try {
      const result = await Product.deleteOne({ _id: prodId }); 
      if (result.deletedCount === 0) {
        console.log('No product found with the given id');
      } else {
        console.log('Product deleted successfully');
      }
    } catch (error) {
      console.error(error);
    }
};

module.exports = deleteProduct;
