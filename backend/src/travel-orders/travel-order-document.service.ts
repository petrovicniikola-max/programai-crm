import { Injectable } from '@nestjs/common';
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { formatSrDate } from './travel-order.util';

const COMPANY = 'ESTUAR DOO';
const COMPANY_LINE =
  'Privredno društvo ESTUAR DOO BEOGRAD sa sedištem u ul. Ustanička 194., Beograd-Zvezdara, PIB: 108953705';

export interface TravelOrderDocInput {
  id: string;
  number: string;
  employeeName: string;
  decisionName: string;
  jobTitle: string;
  origin: string;
  destination: string;
  hostName: string;
  task: string;
  transport: string;
  startDate: string;
  endDate: string;
  departTime: string;
  returnTime: string;
  dayCount: number;
  dailyRate: number;
  totalAmount: number;
  totalInWords: string;
  decisionDate: string;
  settlementDate: string;
}

function foldAscii(value: string): string {
  return value
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function nalogDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)}.${Number(m)}.${y}.`;
}

function racunDate(iso: string): string {
  const [m, d] = iso.slice(0, 10).split('-').slice(1);
  return `${d}.${m}.`;
}

function fullDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}.`;
}

function p(text: string, opts?: { bold?: boolean; center?: boolean; size?: number }): Paragraph {
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 22,
        font: 'Calibri',
      }),
    ],
  });
}

@Injectable()
export class TravelOrderDocumentService {
  async write(order: TravelOrderDocInput): Promise<{ nalogName: string; odlukaName: string }> {
    const dir = path.join(process.cwd(), 'uploads', 'travel-orders', order.id);
    await fs.mkdir(dir, { recursive: true });
    const nalogName = `putni-nalog-${order.number}.pdf`;
    const odlukaName = `odluka-${order.number}.docx`;
    const nalog = await this.nalogPdf(order);
    const odluka = await Packer.toBuffer(this.odlukaDoc(order));
    await fs.writeFile(path.join(dir, nalogName), nalog);
    await fs.writeFile(path.join(dir, odlukaName), odluka);
    return { nalogName, odlukaName };
  }

  async read(id: string, filename: string): Promise<Buffer> {
    return fs.readFile(path.join(process.cwd(), 'uploads', 'travel-orders', id, filename));
  }

  filenames(number: string): { nalogName: string; odlukaName: string } {
    return {
      nalogName: `putni-nalog-${number}.pdf`,
      odlukaName: `odluka-${number}.docx`,
    };
  }

  private async nalogPdf(order: TravelOrderDocInput): Promise<Buffer> {
    const templatePath = path.join(__dirname, 'templates', 'putni-nalog.pdf');
    const pdf = await PDFDocument.load(await fs.readFile(templatePath));
    const form = pdf.getForm();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const set = (name: string, value: string) => {
      form.getTextField(name).setText(foldAscii(value));
    };
    const amount = String(order.totalAmount);
    const rate = String(order.dailyRate);
    set('fill_7', order.employeeName);
    set('fill_8', order.jobTitle);
    set('fill_10', nalogDate(order.startDate));
    set('fill_11', order.hostName);
    set('fill_13', order.task);
    set('fill_17', order.transport);
    set('fill_19', rate);
    set('fill_20', nalogDate(order.endDate));
    set('fill_21', 'Estuar DOO');
    set('fill_3', racunDate(order.startDate));
    set('fill_4', order.departTime);
    set('fill_6', racunDate(order.endDate));
    set('fill_5', order.returnTime);
    set('fill_47', order.origin);
    set('fill_48', order.destination);
    set('fill_51', order.destination);
    set('fill_52', order.origin);
    set('fill_91', String(order.dayCount));
    set('fill_44', rate);
    set('fill_45', amount);
    set('fill_87', amount);
    set('fill_88', '0');
    set('fill_89', '0');
    set('fill_24', 'Beogradu');
    set('fill_25', fullDate(order.settlementDate));
    set('fill_29', amount);
    set('fill_30', order.totalInWords);
    set('fill_33', 'Estuar DOO');
    set('fill_34', 'Beogradu');
    set('fill_35', fullDate(order.settlementDate));
    form.updateFieldAppearances(font);
    return Buffer.from(await pdf.save());
  }

  private odlukaDoc(order: TravelOrderDocInput): Document {
    const start = formatSrDate(order.startDate);
    const end = formatSrDate(order.endDate);
    const decided = formatSrDate(order.decisionDate);
    return new Document({
      sections: [
        {
          children: [
            p(`Na osnovu člana 118. Zakona o radu i za ${COMPANY_LINE}, direktor društva donosi:`),
            p('ODLUKU', { bold: true, center: true, size: 32 }),
            p('o službenom putu', { center: true }),
            p('Za potrebe Privrednog društva ESTUAR DOO, određujem (ime i prezime):'),
            p(`– ${order.decisionName} – ${order.jobTitle},`),
            p(`da izvrši službeno putovanje na ${order.destination}, ${order.hostName}.`),
            p(
              `Službeno putovanje će se izvršiti u periodu od ${start} do ${end}, odnosno do završetka poslova za koje se upućuje.`,
            ),
            p('Troškovi službenog putovanja padaju na teret Privrednog društva ESTUAR DOO u Beogradu.'),
            p(`U Beogradu, ${decided}`),
            p('Direktor'),
          ],
        },
      ],
    });
  }
}
