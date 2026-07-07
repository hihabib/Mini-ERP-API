import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createSaleSchema } from './sale.validation.js';
import * as saleController from './sale.controller.js';

const router = Router();

/**
 * @openapi
 * /sales:
 *   post:
 *     summary: Create a new sale
 *     description: >
 *       Records a sale for one or more products. Prices and totals are calculated
 *       server-side from the current product data — never trust client-supplied prices.
 *       Stock is decremented atomically; if any item has insufficient stock the entire
 *       sale is rejected and no stock is changed.
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [product, quantity]
 *                   properties:
 *                     product:
 *                       type: string
 *                       description: MongoDB ObjectId of the product
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *     responses:
 *       201:
 *         description: Sale created — includes snapshots and grandTotal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error or insufficient stock
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: One or more referenced products not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  authenticate,
  requirePermission('sale:create'),
  validate(createSaleSchema),
  saleController.create,
);

/**
 * @openapi
 * /sales:
 *   get:
 *     summary: List sale history (paginated)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: soldBy
 *         schema:
 *           type: string
 *         description: Filter by seller user ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field — prefix with - for descending (default -createdAt)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated list of sales
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     meta:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', authenticate, requirePermission('sale:view'), saleController.list);

/**
 * @openapi
 * /sales/{id}:
 *   get:
 *     summary: Get a sale by ID (full detail)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the sale
 *     responses:
 *       200:
 *         description: Sale found — includes all items, snapshots, and seller info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authenticate, requirePermission('sale:view'), saleController.getOne);

export default router;
