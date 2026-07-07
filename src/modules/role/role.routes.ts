import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import * as roleController from './role.controller.js';

const router = Router();

router.use(authenticate);

// We allow user:create or user:update permissions to view roles so they can populate the role dropdown
router.get('/', requirePermission('user:view'), roleController.getRoles);

export default router;
