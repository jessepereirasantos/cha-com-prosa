const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const instanceController = require('../controllers/instanceController');
const flowController = require('../controllers/flowController');
const messageController = require('../controllers/messageController');
const uploadController = require('../controllers/uploadController');
const analyticsController = require('../controllers/analyticsController');
const planController = require('../controllers/planController');
const eventController = require('../controllers/eventController');
const webhookController = require('../controllers/webhookController');
const subscriptionController = require('../controllers/subscriptionController');
const couponController = require('../controllers/couponController');
const adminController = require('../controllers/adminController');
const paymentController = require('../controllers/paymentController');
const triggerController = require('../controllers/triggerController');
const authMiddleware = require('../middlewares/auth');
const adminMiddleware = require('../middlewares/adminAuth');

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/profile/password', authMiddleware, authController.changePassword);

router.get('/instances', authMiddleware, instanceController.listInstances);
router.post('/instances', authMiddleware, instanceController.createInstance);
router.post('/instances/:id/connect', authMiddleware, instanceController.connectInstance);
router.post('/instances/:id/start', authMiddleware, instanceController.connectInstance);
router.get('/instances/:id/qrcode', authMiddleware, instanceController.getQRCode);
router.get('/instances/:id/status', authMiddleware, instanceController.getInstanceStatus);
router.put('/instances/:id/flow', authMiddleware, instanceController.setInstanceFlow);
router.post('/instances/:id/disconnect', authMiddleware, instanceController.disconnectInstance);
router.delete('/instances/:id', authMiddleware, instanceController.deleteInstance);

router.get('/flows', authMiddleware, flowController.listFlows);
router.get('/flows/:id', authMiddleware, flowController.getFlow);
router.get('/flows/:id/structure', authMiddleware, flowController.getFlowStructure);
router.post('/flows/upload', authMiddleware, uploadController.uploadMiddleware, uploadController.uploadFlowMedia);
router.post('/flows/:id/duplicate', authMiddleware, flowController.duplicateFlow);
router.post('/flows/:id/activate', authMiddleware, flowController.activateFlow);
router.post('/flows', authMiddleware, flowController.createFlow);
router.put('/flows/:id', authMiddleware, flowController.updateFlow);
router.delete('/flows/:id', authMiddleware, flowController.deleteFlow);
router.post('/upload', authMiddleware, uploadController.uploadMiddleware, uploadController.uploadFlowMedia);

router.post('/messages/send', authMiddleware, messageController.sendMessage);
router.get('/messages', authMiddleware, messageController.listMessages);
router.get('/contacts', authMiddleware, messageController.listContacts);

router.get('/analytics/summary', authMiddleware, analyticsController.getAnalyticsSummary);

router.get('/plans', planController.listPlans);
router.get('/plans/my', authMiddleware, planController.getMyPlan);
router.get('/plans/limits', authMiddleware, planController.checkLimits);

router.post('/events/purchase', authMiddleware, eventController.triggerPurchaseEvent);
router.post('/events/custom', authMiddleware, eventController.triggerCustomEvent);

router.post('/webhooks/mercadopago', webhookController.handleMercadoPagoWebhook);

router.post('/subscriptions', authMiddleware, subscriptionController.createSubscription);
router.get('/subscriptions/my', authMiddleware, subscriptionController.getMySubscription);
router.delete('/subscriptions/:id', authMiddleware, subscriptionController.cancelSubscription);

router.post('/coupons', adminMiddleware, couponController.createCoupon);
router.get('/coupons', adminMiddleware, couponController.listCoupons);
router.post('/coupons/validate', authMiddleware, couponController.validateCoupon);
router.get('/coupons/validate/:code', couponController.validateCouponPublic);
router.put('/coupons/:id/deactivate', adminMiddleware, couponController.deactivateCoupon);

router.post('/payments/process', authMiddleware, paymentController.processPayment);
router.get('/payments/status', authMiddleware, paymentController.checkPaymentStatus);
router.delete('/coupons/:id', adminMiddleware, couponController.deleteCoupon);

router.get('/auth/me', authMiddleware, adminController.getUserInfo);

router.get('/admin/stats', adminMiddleware, adminController.getDashboardStats);
router.get('/admin/clients', adminMiddleware, adminController.listClients);
router.get('/admin/clients/:id', adminMiddleware, adminController.getClientDetails);
router.post('/admin/clients', adminMiddleware, adminController.createClient);
router.put('/admin/clients/:id', adminMiddleware, adminController.updateClient);
router.delete('/admin/clients/:id', adminMiddleware, adminController.deleteClient);
router.get('/admin/plans', adminMiddleware, adminController.listPlans);
router.post('/admin/plans', adminMiddleware, adminController.createPlan);
router.put('/admin/plans/:id', adminMiddleware, adminController.updatePlan);
router.delete('/admin/plans/:id', adminMiddleware, adminController.deletePlan);
router.post('/admin/subscriptions/grant', adminMiddleware, adminController.grantSubscription);
router.get('/admin/subscriptions', adminMiddleware, adminController.listAllSubscriptions);
router.get('/admin/instances', adminMiddleware, adminController.listAllInstances);
router.get('/admin/flows', adminMiddleware, adminController.listAllFlows);
router.post('/admin/support/instance', adminMiddleware, adminController.createSupportInstance);
router.post('/admin/support/flow', adminMiddleware, adminController.createSupportFlow);

// Triggers externos (integração com plataforma de cursos)
router.get('/health', triggerController.healthCheck);
router.post('/triggers/create', authMiddleware, triggerController.createTrigger);
router.get('/triggers', authMiddleware, triggerController.listTriggers);

module.exports = router;
