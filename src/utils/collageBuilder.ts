import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import sharp from 'sharp';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { join } from 'path';
import fontColorContrast from 'font-color-contrast';

const FORMAT_CONFIGS = {
  regular: {
    width: 1100,
    height: 1400,
  },
  instagramFeed: {
    width: 1080,
    height: 1080,
  },
  instagramStory: {
    width: 1080,
    height: 1920,
  },
};

export class CollageBuilder {
  async resizeImages(imagesBuffers: ArrayBuffer[]): Promise<Buffer[]> {
    const resizedImages: Promise<Buffer>[] = [];

    for (const imageBuffer of imagesBuffers) {
      const size: number = imagesBuffers.length === 0 ? 500 : 300;
      const resizedImageBuffer = sharp(imageBuffer)
        .resize(size, size)
        .toBuffer();
      resizedImages.push(resizedImageBuffer);
    }

    let images = [];

    try {
      images = await Promise.all(resizedImages);
    } catch (error) {
      console.log(error);
      throw new Error('Error resizing images');
    }

    return images;
  }

  async downloadImagesBuffers(imageUrls: string[]): Promise<ArrayBuffer[]> {
    const imagesPromises = imageUrls.map((url) =>
      axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
    );

    const imageResponses = await Promise.allSettled(imagesPromises);
    const imagesResponsePromises = imageResponses.map(
      async (responsePromise) => {
        const response = responsePromise;
        if (response.status !== 'fulfilled') {
          const retryResponse = await axios.get<ArrayBuffer>(
            response.reason.config.url,
            {
              responseType: 'arraybuffer',
            }
          );
          return retryResponse.data;
        }

        return response.value.data;
      }
    );

    const images = await Promise.all(imagesResponsePromises);

    return images;
  }

  async resizeAndCrop(originalImage: any) {
    const canvas = createCanvas(500, 500);
    const ctx = canvas.getContext('2d');

    // Resize the image to 500x500
    ctx.drawImage(originalImage, 0, 0, 500, 500);

    // Calculate crop coordinates for center crop (adjust as needed)
    const cropX = 0;
    const cropY = (500 - 300) / 2; // To vertically center the crop
    const cropWidth = 500;
    const cropHeight = 300;

    // Perform the cropping
    const croppedImage = canvas.toDataURL('image/jpeg', 1.0); // Convert to JPEG
    const croppedCanvas = createCanvas(cropWidth, cropHeight);
    const croppedCtx = croppedCanvas.getContext('2d');
    const croppedImageObj = await loadImage(croppedImage);
    croppedCtx.drawImage(
      croppedImageObj,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    // Save the cropped image
    return await loadImage(croppedCanvas.toBuffer());
  }

  async addBorder(image: any, width: number, height: number) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);

    // Add a border to the image
    const borderWidth = 1; // Adjust as needed
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Save the final image
    return loadImage(canvas.toBuffer());
  }

  async createCollage(
    images: any,
    chartNames: string[],
    name: string,
    type: string
  ) {
    const canvasWidth = 1100;
    const canvasHeight = 1400;
    const collageCanvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = collageCanvas.getContext('2d');
    registerFont(join(__dirname, '../resources/fonts/BebasNeueRegular.ttf'), {
      family: "'Bebas Neue', sans-serif",
    });

    let x = 45;
    let y = 385;
    let counter = 1;

    const background = fs.readFileSync(
      join(__dirname, '../resources/images/card-background.png')
    );
    const backgroundImg = await loadImage(background);
    ctx.drawImage(backgroundImg, 0, 0);
    const firtsImageX = 550;
    const firtsImageY = 40;
    const firstImage = await loadImage(images[0]);
    const croppedImage = await this.resizeAndCrop(firstImage);
    const croppedImageWithBorder = await this.addBorder(croppedImage, 500, 300);
    this.drawWithEffect(ctx, croppedImageWithBorder, firtsImageX, firtsImageY);
    const firtsImageCounter = `#0${counter++}`;
    const firstImageName = chartNames[0];
    ctx.font = '50px Bebas Neue'; // Font size and name
    let color = await this.getColorInfo(images[0], 30, 35, 80, 80);
    let textColor = fontColorContrast(color);
    ctx.fillStyle = textColor; // Text color
    ctx.fillText(firtsImageCounter, firtsImageX + 30, firtsImageY + 35);
    ctx.font = '36px Bebas Neue'; // Font size and name

    color = await this.getColorInfo(images[0], 30, 250, 250, 50);
    textColor = fontColorContrast(color);
    ctx.fillStyle = textColor; // Text color
    this.textEllipsis(
      ctx,
      firstImageName,
      firtsImageX + 30,
      firtsImageY + 270,
      250
    );

    images.shift();
    chartNames.shift();

    for (let index = 0; index < images.length; index++) {
      const imageBuffer = images[index];
      const imageName = chartNames[index];

      const image = await loadImage(imageBuffer);
      const imageWithBorder = await this.addBorder(image, 300, 300);
      this.drawWithEffect(ctx, imageWithBorder, x, y);
      const cardCounter = `#${counter < 10 ? '0' + counter++ : counter++}`;
      ctx.font = '50px Bebas Neue'; // Font size and name
      let color = await this.getColorInfo(imageBuffer, 30, 35, 80, 80);
      let textColor = fontColorContrast(color);
      ctx.fillStyle = textColor; // Text color
      ctx.fillText(cardCounter, x + 30, y + 35);
      ctx.font = '36px Bebas Neue'; // Font size and name

      color = await this.getColorInfo(imageBuffer, 30, 250, 250, 50);
      textColor = fontColorContrast(color);
      ctx.fillStyle = textColor; // Text color

      this.textEllipsis(ctx, imageName, x + 30, y + 270, 250);

      // Adjust position for the next image (you can implement your layout logic here)
      x += 350;
      if (x + image.width > canvasWidth) {
        x = 45;
        y += 350;
      }
    }

    // Set font properties
    ctx.font = '70px Bebas Neue'; // Font size and name
    ctx.fillStyle = '#FFFFFF'; // Text color

    // Draw the text on the canvas
    const text1 = name.toUpperCase();
    const text2 = `TOP ${type.toUpperCase()}`;
    const textX = 45; // X-coordinate of the text
    const textY = 90; // Y-coordinate of the text
    ctx.fillText(text1, textX, textY);
    ctx.font = '46px Bebas Neue'; // Font size and name
    let xText = textX;
    for (const char of text2) {
      ctx.fillText(char, xText, textY + 60);
      const charWidth = ctx.measureText(char).width + 10;
      xText += charWidth;
    }

    return await collageCanvas.toBuffer();
  }

  drawWithEffect(ctx: any, image: any, x: number, y: number) {
    ctx.drawImage(image, x, y);
    ctx.drawImage(image, x + 10, y - 10);
    ctx.drawImage(image, x + 20, y - 20);
  }

  async getColorInfo(
    imageBuffer: Buffer,
    regionX: number,
    regionY: number,
    regionWidth: number,
    regionHeight: number
  ) {
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bytesPerPixel = info.channels;
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;

    // Ensure that region coordinates are within image bounds
    regionX = Math.max(0, regionX);
    regionY = Math.max(0, regionY);
    regionWidth = Math.min(regionWidth, info.width - regionX);
    regionHeight = Math.min(regionHeight, info.height - regionY);

    for (let y = regionY; y < regionY + regionHeight; y++) {
      for (let x = regionX; x < regionX + regionWidth; x++) {
        const index = (y * info.width + x) * bytesPerPixel;
        totalR += data[index];
        totalG += data[index + 1];
        totalB += data[index + 2];
      }
    }

    const numPixels = regionWidth * regionHeight;
    const avgR = Math.round(totalR / numPixels);
    const avgG = Math.round(totalG / numPixels);
    const avgB = Math.round(totalB / numPixels);

    return [avgR, avgG, avgB];
  }

  textEllipsis(ctx: any, text: string, x: number, y: number, maxWidth: number) {
    let width = ctx.measureText(text).width;
    let ellipsis = '...';
    let characterRemoved = false;
    while (width > maxWidth) {
      characterRemoved = true;
      // remove last character
      text = text.slice(0, -1);
      width = ctx.measureText(text + ellipsis).width;
    }
    ctx.fillText(text + (characterRemoved ? ellipsis : ''), x, y);
  }
}
