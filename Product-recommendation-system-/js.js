const products = {
  electronics: {
    low: "Bluetooth Earbuds",
    medium: "Smartwatch",
    high: "Noise Cancelling Headphones"
  },
  books: {
    low: "Pocket Novel",
    medium: "Hardcover Bestseller",
    high: "Collector's Edition Box Set"
  },
  fashion: {
    low: "Graphic T-Shirt",
    medium: "Stylish Sneakers",
    high: "Designer Jacket"
  }
};

document.getElementById("recommendationForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const category = document.getElementById("category").value;
  const budget = document.getElementById("budget").value;

  const recommendation = products[category][budget];
  document.getElementById("result").innerText = `Recommended: ${recommendation}`;
});
