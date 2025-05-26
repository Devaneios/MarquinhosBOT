import { logger } from '@marquinhos/utils/logger';
import { google, sheets_v4 } from 'googleapis';

export class SpreadsheetService {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;
  private static instance: SpreadsheetService;

  constructor() {
    this.spreadsheetId = process.env.MARQUINHOS_SPREADSHEET_ID || '';
    this.sheets = google.sheets({
      version: 'v4',
      auth: process.env.MARQUINHOS_SPREADSHEET_API_KEY,
    });
    logger.info('Google Sheets API initialized with API key');
  }

  public static getInstance(): SpreadsheetService {
    if (!SpreadsheetService.instance) {
      SpreadsheetService.instance = new SpreadsheetService();
    }
    return SpreadsheetService.instance;
  }

  async getValues<T>(sheetName: string, range: string): Promise<T[][]> {
    try {
      const fullRange = `${sheetName}!${range}`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: fullRange,
      });

      return response.data.values || [];
    } catch (error: any) {
      logger.error(
        `Failed to read spreadsheet data from ${sheetName}!${range}:`,
        error
      );
      throw new Error(`Failed to read spreadsheet data: ${error.message}`);
    }
  }

  async getRowsAsObjects<T>(sheetName: string, range: string): Promise<T[]> {
    const values = await this.getValues<string>(sheetName, range);

    if (values.length === 0) {
      return [];
    }

    const headers = values[0];
    return values.slice(1).map((row) => {
      const obj: Record<string, string | null> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] !== undefined ? row[index] : null;
      });
      return obj as T;
    });
  }

  async getSheetNames(): Promise<string[]> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets.properties.title',
      });

      return (
        response.data.sheets
          ?.map((sheet) => sheet.properties?.title || '')
          .filter(Boolean) || []
      );
    } catch (error: any) {
      logger.error('Failed to get sheet names:', error);
      throw new Error(`Failed to get sheet names: ${error.message}`);
    }
  }

  async findRow(
    sheetName: string,
    searchColumn: number,
    searchValue: string,
    range?: string
  ): Promise<unknown[] | null> {
    const values = await this.getValues<string>(sheetName, range || '');

    for (const row of values) {
      if (row[searchColumn] === searchValue) {
        return row;
      }
    }

    return null;
  }
}
