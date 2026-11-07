import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import { health } from '@marquinhos/contracts/http/routes/health';
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): ContractResponseInput<typeof health> {
    return { status: 'ok' };
  }
}
