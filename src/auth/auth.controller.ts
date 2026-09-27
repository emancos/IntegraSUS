import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('token')
  @ApiOperation({ summary: 'Gerar token JWT de acesso' })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        client_id: { type: 'string', example: 'sigtap-frontend-dev' }, 
        client_secret: { type: 'string', example: 'segredo-sigtap-123' } 
      } 
    } 
  })
  async getToken(@Body() body: { client_id: string; client_secret: string }) {
    return this.authService.login(body.client_id, body.client_secret);
  }
}
