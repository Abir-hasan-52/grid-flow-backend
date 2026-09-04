import { Router } from 'express'
// import { Role } from '../../../generated/prisma/enums'
import { auth } from '../../middleware/checkAuth'
import { Role } from '../../../../generated/prisma/enums';
import { AuthController } from './auth.controller';
// import { AuthController } from './auth.controller'

const router = Router()

router.post('/register', AuthController.registerPatient)
router.post('/login', AuthController.loginUser)
router.get(
    '/me',
    auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN, Role.ZONE_MANAGER),
    AuthController.getMe,
)
router.post('/refresh-token', AuthController.refreshToken)
export const AuthRoutes = router