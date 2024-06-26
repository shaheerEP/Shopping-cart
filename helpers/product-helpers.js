const mongoose = require('mongoose');
const {Order,User} = require('../helpers/schema')
// Define the product schema

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: String, // Array of strings
  description: String,
  image: String,
 
});


// Create a Mongoose model for products
const Product = mongoose.model('Product', productSchema);


const addProduct = async (productData) => {
  try {
    const existingProduct = await Product.findOne({ name: productData.name });
    if (!existingProduct) {
      const newProduct = await Product.create(productData);
      console.log(`Product "${newProduct.name}" added successfully!`);
      return newProduct; // Return the new product 
    } else {
      const error = new Error(`Product "${productData.name}" already exists.`);
      error.code = 'duplicate'; // Add a custom error code
      throw error;
    }
  } catch (error) {
    console.error('Error adding product:', error);
    throw error; // Rethrow the error to be handled by the route handler
  }
};

      const getAllProducts = async () => {
        try {
          const products = await Product.find({});
          
          return products;
        } catch (error) {
          console.error('Error fetching products:', error);
        }
      }
      
      const deleteProduct = async (prodId) => {
        try {
          const product = await Product.findOne({ _id: prodId });
          if (!product) {
            console.log('No product found with the given id');
            return null;
          } else {
            await Product.deleteOne({ _id: prodId });
            console.log('Product deleted successfully');
            return product;
          }
        } catch (error) {
          console.error(error);
          throw error; // Re-throw the error after logging it
        }
      };
      
      

const  getProductDetails = async (prodId) => {
  try {
    const product = await Product.findById(prodId);
    // console.log(product);
    return product;
  } catch (error) {
    console.error(error);
  }
}

const isLocalImage = function(image) {
  return !image.startsWith('https://');
};


 const updateProduct =async (productId, productData) =>{
  try {
    // Get the current product data
    const currentProduct = await Product.findById(productId);
    if (!currentProduct) {
      return { error: 'Product not found' }; // Handle non-existent product
    }

    // Update only the fields that are present in productData
    for (let field in productData) {
      currentProduct[field] = productData[field];
    }

    // Save the updated product
    const updatedProduct = await currentProduct.save();

    return { message: 'Product updated successfully', product: updatedProduct };
  } catch (error) {
    console.error(error);
    return { error: 'Internal server error' }; // Handle generic error
  }
}

module.exports = {
  Product,
  addProduct,
  getAllProducts,
  deleteProduct,
  getProductDetails,
  updateProduct,
  isLocalImage
  // More exports...
};




// Cart.aggregate(totalOrdersOfWholeProducts)
//   .then(results => {
//     console.log('Sum of Orders for Each Product (Name):', results); // Array of objects with product name and total orders
//   })
//   .catch(err => console.error(err));
