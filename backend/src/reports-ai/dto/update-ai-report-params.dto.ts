import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateAiReportParamsDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  /** 1–12 = jedan mesec; izostavi ili null = cela godina (ako je year zadat) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number | null;
}
