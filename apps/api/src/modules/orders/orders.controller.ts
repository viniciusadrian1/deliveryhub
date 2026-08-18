import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type DispatchSelfDeliveryInput,
  dispatchSelfDeliverySchema,
  type ListOrdersQuery,
  listOrdersQuerySchema,
  type RejectOrderInput,
  rejectOrderSchema,
} from './dto/orders.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery,
  ) {
    return this.orders.list(auth, query);
  }

  @Get(':id')
  findOne(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.orders.findOne(auth, id);
  }

  /** Posição do entregador da plataforma (iFood Logistics — GPS ao vivo). */
  @Get(':id/tracking')
  tracking(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.orders.getTracking(auth, id);
  }

  @Post(':id/accept')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(200)
  accept(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.orders.accept(auth, id);
  }

  @Post(':id/preparing')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(200)
  preparing(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.orders.startPreparing(auth, id);
  }

  @Post(':id/ready')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(200)
  ready(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.orders.markReady(auth, id);
  }

  @Post(':id/dispatch')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(200)
  dispatch(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.orders.dispatch(auth, id);
  }

  @Post(':id/delivered')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(200)
  delivered(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.orders.markDelivered(auth, id);
  }

  @Post(':id/reject')
  @Roles('owner', 'manager')
  @HttpCode(200)
  reject(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectOrderSchema)) body: RejectOrderInput,
  ) {
    return this.orders.reject(auth, id, body.reason);
  }

  /** Confirma o recebimento em dinheiro (pedidos cash do 99Food). */
  @Post(':id/confirm-cash')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(200)
  confirmCash(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.orders.confirmCashPayment(auth, id);
  }

  /** Despacha um pedido de entrega própria do 99Food com os dados do entregador. */
  @Post(':id/dispatch-self')
  @Roles('owner', 'manager', 'staff')
  @HttpCode(200)
  dispatchSelf(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dispatchSelfDeliverySchema)) body: DispatchSelfDeliveryInput,
  ) {
    return this.orders.dispatchSelfDelivery(auth, id, body);
  }
}
