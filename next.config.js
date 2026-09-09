/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true, // <--- disables the optimization API safely
  },
  //   assetPrefix: "https://s3.ap-south-1.amazonaws.com/picapool.com/",
  trailingSlash: true, // VERY IMPORTANT
};

module.exports = nextConfig;
