import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

/**
 * @openapi
 * /dashboard/stats:
 *   get:
 *     summary: Get dashboard summary statistics
 *     description: >
 *       Returns aggregated counts and revenue totals. All aggregations run concurrently
 *       via Promise.all and use MongoDB aggregation pipelines — no full-collection loads
 *       into Node.js memory. The Dashboard is a passive consumer of the `stock:updated`
 *       and `sale:created` Socket.io events emitted by the Sale module; it emits no
 *       events of its own.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalProducts:
 *                           type: integer
 *                           description: Total number of products
 *                         totalSales:
 *                           type: integer
 *                           description: Total number of sale transactions
 *                         totalRevenue:
 *                           type: number
 *                           description: Sum of grandTotal across all sales
 *                         lowStockProducts:
 *                           type: array
 *                           description: Up to 10 products with stockQuantity < 5, sorted most-urgent first
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               sku:
 *                                 type: string
 *                               stockQuantity:
 *                                 type: integer
 *                         lowStockCount:
 *                           type: integer
 *                           description: True total count of low-stock products (may exceed lowStockProducts length)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/stats',
  authenticate,
  requirePermission('dashboard:view'),
  dashboardController.getStats,
);

export default router;
