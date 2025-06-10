const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ImageRendererService {
  constructor() {
    // Directory for storing generated images
    this.imageDir = path.join(process.env.HOME || process.env.USERPROFILE, '.lit-desktop', 'images');
    
    // Ensure image directory exists
    fs.mkdirSync(this.imageDir, { recursive: true });
    
    // Define available tools
    this.tools = [
      {
        name: 'render_image',
        description: 'Display an image in the chat from base64-encoded data. Use this for displaying screenshots from puppeteer_screenshot or other base64 images.',
        parameters: {
          data: {
            type: 'string',
            description: 'Base64 encoded image data (without the "data:image/png;base64," prefix)'
          },
          mimeType: {
            type: 'string',
            description: 'MIME type of the image (e.g., image/png, image/jpeg, image/svg+xml)'
          },
          altText: {
            type: 'string',
            description: 'Alternative text for the image for accessibility'
          }
        }
      },
      {
        name: 'render_svg',
        description: 'Display an SVG visualization in the chat. Use this for creating diagrams, charts, and other vector graphics.',
        parameters: {
          svg: {
            type: 'string',
            description: 'Complete SVG code including the <svg> tags with width, height, and xmlns attributes'
          },
          altText: {
            type: 'string',
            description: 'Alternative text for the image for accessibility'
          }
        }
      }
    ];
    
    console.log(`ImageRendererService initialized with image directory: ${this.imageDir}`);
  }

  // Get all available tools
  getAllTools() {
    return this.tools;
  }

  // Call a tool
  async callTool(toolName, args) {
    console.log(`Image Renderer calling tool: ${toolName} with args:`, args);
    
    switch (toolName) {
      case 'render_image':
        return this.renderImage(args);
      case 'render_svg':
        return this.renderSvg(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Render a provided base64 image
  async renderImage(args) {
    try {
      const { data, mimeType, altText } = args;
      
      if (!data) {
        throw new Error('Missing required parameter: data');
      }
      
      // Log the size of the incoming data
      console.log(`Processing image data (${data.length} bytes)`);
      
      const actualMimeType = mimeType || 'image/png';
      const actualAltText = altText || 'Generated image';
      
      // Generate a unique file name
      const hash = crypto.createHash('md5').update(data).digest('hex');
      const fileExt = this.getFileExtension(actualMimeType);
      const fileName = `${hash}.${fileExt}`;
      const filePath = path.join(this.imageDir, fileName);
      
      // Save the image to disk
      const buffer = Buffer.from(data, 'base64');
      await fs.promises.writeFile(filePath, buffer);
      
      console.log(`Image saved to ${filePath}`);
      
      // Return the result with data URL
      return {
        success: true,
        filePath: filePath,
        imageData: `data:${actualMimeType};base64,${data}`,
        altText: actualAltText,
        type: 'image'
      };
    } catch (error) {
      console.error('Error rendering image:', error);
      throw error;
    }
  }

  // Render an SVG image
  async renderSvg(args) {
    try {
      const { svg, altText } = args;
      
      if (!svg) {
        throw new Error('Missing required parameter: svg');
      }
      
      const actualAltText = altText || 'SVG image';
      
      // Generate a unique file name based on SVG content
      const hash = crypto.createHash('md5').update(svg).digest('hex');
      const fileName = `${hash}.svg`;
      const filePath = path.join(this.imageDir, fileName);
      
      // Save the SVG to disk
      await fs.promises.writeFile(filePath, svg, 'utf8');
      
      console.log(`SVG saved to ${filePath}`);
      
      // Convert SVG to base64
      const base64Data = Buffer.from(svg).toString('base64');
      
      // Return the result
      return {
        success: true,
        filePath: filePath,
        imageData: `data:image/svg+xml;base64,${base64Data}`,
        altText: actualAltText,
        type: 'image'
      };
    } catch (error) {
      console.error('Error rendering SVG:', error);
      throw error;
    }
  }

  // Get file extension from MIME type
  getFileExtension(mimeType) {
    const mimeMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    
    return mimeMap[mimeType] || 'png';
  }
}

module.exports = new ImageRendererService();

module.exports = new ImageRendererService();