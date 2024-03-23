import { Image, createCanvas, loadImage, registerFont } from 'canvas';
import { join } from 'path';
import axios from 'axios';
import fs from 'fs';
import sharp from 'sharp';
import fontColorContrast from 'font-color-contrast';

const FORMAT_CONFIGS = {
  regular: {
    width: 1100,
    height: 1400,
    namePosition: {
      x: 45,
      y: 90,
    },
    typePosition: {
      x: 45,
      y: 150,
    },
    firstImagePosition: {
      x: 550,
      y: 40,
    },
    firstImageWidth: 500,
    firstImageHeight: 300,
    imageWidth: 300,
    imageHeight: 300,
    imageBorderWidth: 1,
    imageBorderOffset: 10,
    imageCounterPosition: {
      x: 30,
      y: 35,
    },
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
      const size: number = resizedImages.length === 0 ? 500 : 300;
      const resizedImageBuffer = sharp(imageBuffer)
        .resize(size, size)
        .toBuffer();
      resizedImages.push(resizedImageBuffer);
    }

    let images = [];

    try {
      images = await Promise.all(resizedImages);
    } catch (error) {
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

  async addBorder(image: Image, width: number, height: number) {
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

  setupCanvas() {
    const canvasWidth = 1100;
    const canvasHeight = 1600;
    const collageCanvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = collageCanvas.getContext('2d');
    registerFont(join(__dirname, '../resources/fonts/BebasNeueRegular.ttf'), {
      family: "'Bebas Neue', sans-serif",
    });
    return { ctx, collageCanvas, canvasWidth, canvasHeight };
  }

  async drawBackground(ctx: any, canvasWidth: number, canvasHeight: number) {
    const background = fs.readFileSync(
      join(__dirname, '../resources/images/card-background.png')
    );
    const backgroundImg = await loadImage(background);
    ctx.drawImage(backgroundImg, 0, 0);
  }

  async drawFirstImage(
    ctx: any,
    firstImage: Image,
    firstImageBuffer: Buffer,
    footerText: string,
    firtsImageX: number,
    firtsImageY: number,
    width: number,
    height: number
  ) {
    const imageWithBorder = await this.addBorder(firstImage, width, height);
    this.drawWithEffect(ctx, imageWithBorder, firtsImageX, firtsImageY);

    const firtsImageCounter = '#01';
    const firstImageName = footerText;
    ctx.font = '80px Bebas Neue'; // Font size and name
    let color = await this.getColorInfo(firstImageBuffer, 30, 35, 90, 80);
    let textColor = fontColorContrast(color);
    ctx.fillStyle = textColor; // Text color
    ctx.fillText(firtsImageCounter, firtsImageX + 30, firtsImageY + 70);
    ctx.font = '50px Bebas Neue'; // Font size and name

    color = await this.getColorInfo(
      firstImageBuffer,
      30,
      410,
      ctx.measureText(firstImageName).width,
      50
    );
    textColor = fontColorContrast(color);
    ctx.fillStyle = textColor; // Text color
    this.textEllipsis(
      ctx,
      firstImageName,
      firtsImageX + 30,
      firtsImageY + 450,
      470
    );
  }

  async createCollage(
    images: Buffer[],
    chartNames: string[],
    name: string,
    type: string,
    period: string = 'overall'
  ) {
    const { ctx, collageCanvas, canvasWidth, canvasHeight } =
      this.setupCanvas();
    await this.drawBackground(ctx, canvasWidth, canvasHeight);
    const firstImageBuffer = images.shift();
    if (!firstImageBuffer) return Buffer.from('');
    const firstImage = await loadImage(firstImageBuffer);
    const firstFooterText = chartNames.shift();
    if (!firstFooterText) return Buffer.from('');
    await this.drawFirstImage(
      ctx,
      firstImage,
      firstImageBuffer,
      firstFooterText,
      550,
      40,
      500,
      500
    );

    let x = 45;
    let y = 590;
    let counter = 2;

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
    const textX = 45; // X-coordinate of the text
    const textY = 250; // Y-coordinate of the text
    ctx.font = '70px Bebas Neue'; // Font size and name
    ctx.fillStyle = '#FFFFFF'; // Text color
    const userProfileName = name.toUpperCase();
    ctx.fillText(userProfileName, textX, textY);

    // Draw the text on the canvas
    const categoryType = `TOP ${type.toUpperCase()}`;
    ctx.font = '46px Bebas Neue'; // Font size and name
    let categoryTypeTextX = textX;
    for (const char of categoryType) {
      ctx.fillText(char, categoryTypeTextX, textY + 70);
      const charWidth = ctx.measureText(char).width + 10;
      categoryTypeTextX += charWidth;
    }

    const periodMessage = this.parsePeriodMessage(period);
    ctx.font = '32px Bebas Neue'; // Font size and name
    let periodMessageTextX = textX;
    for (const char of periodMessage) {
      ctx.fillText(char, periodMessageTextX, textY + 130);
      const charWidth = ctx.measureText(char).width + 15;
      periodMessageTextX += charWidth;
    }

    return collageCanvas.toBuffer();
  }

  parsePeriodMessage(period: string) {
    switch (period) {
      case '7day':
        return 'Last Week';
      case '1month':
        return 'Last month';
      case '3month':
        return 'Last 3 months';
      case '6month':
        return 'Last 6 months';
      case '12month':
        return 'Last year';
      case 'overall':
        return 'All time';
      default:
        return 'All time';
    }
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
