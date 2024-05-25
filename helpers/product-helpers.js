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


const addProduct = async (productData)=> {
        try {
          const existingProduct = await Product.findOne({ name: productData.name });
          if (!existingProduct) {
            const newProduct = await Product.create(productData);
            console.log(`Product "${newProduct.name}" added successfully!`);
          } else {
            console.log(`Product "${productData.name}" already exists. Skipping insertion.`);
          }
        } catch (error) {
          console.error('Error adding product:', error);
        }
      }

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
    const result = await Product.deleteOne({ _id: prodId });
    if (result.deletedCount === 0) {
      console.log('No product found with the given id');
    } else {
      console.log('Product deleted successfully');
    }
  } catch (error) {
    console.error(error);
  }
  
}

const  getProductDetails = async (prodId) => {
  try {
    const product = await Product.findById(prodId);
    // console.log(product);
    return product;
  } catch (error) {
    console.error(error);
  }
}

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
  updateProduct
  // More exports...
};

const totalOrdersOfWholeProducts = [
  {
    $addFields: { // New stage to convert strings to ObjectIds
      productObjectIds: {
        $map: {
          input: '$products',
          as: 'productId',
          in: { $toObjectId: '$$productId' }
        }
      }
    }
  },
  {
    $lookup: {
      from: 'products',
      localField: 'productObjectIds', // Use the converted array of ObjectIds
      foreignField: '_id',
      as: 'productDetails'
    }
  },
  
  {
    $unwind: '$productDetails' // Unwind the joined product details array
  },
  {
    $group: {
      _id: '$productDetails.name', // Group by product name (assuming name exists in Product schema)
      totalOrders: { $sum: 1 } // Count the occurrences (orders) for each product
    }
  },
  {
    $project: { // Project desired fields
      _id: 0, // Exclude unnecessary _id field
      productName: '$_id', // Rename grouped field to 'productName'
      totalOrders: '$totalOrders'
    }
  }
];

// Cart.aggregate(totalOrdersOfWholeProducts)
//   .then(results => {
//     console.log('Sum of Orders for Each Product (Name):', results); // Array of objects with product name and total orders
//   })
//   .catch(err => console.error(err));
