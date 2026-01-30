const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { loadTenantConfig } = require("../middlewares/loadTenantConfig");
const { resolveBranch } = require("../middlewares/resolveBranch");
const { resolveMembership } = require("../middlewares/resolveMembership");
const { requireScope } = require("../middlewares/requireScope");
const { requireModule } = require("../middlewares/requireModule");
const {
  listOrdersByStage,
  claimNextStage,
  claimStageByOrder,
  startStage,
  completeStage
} = require("../controllers/workflow");

const router = Router();

const requireModuleForStage = (req, res, next) => {
  const stageKey = req.params.stageKey;
  const stages = req.tenantConfig?.operations?.workflow?.stages || [];
  const stage = stages.find((s) => s.key === stageKey);

  if (!stage) {
    return res.status(404).json({
      ok: false,
      data: null,
      message: "Etapa no encontrada"
    });
  }

  if (stage.role === "KITCHEN") {
    return requireModule("kdsKitchen")(req, res, next);
  }
  if (stage.role === "DISPATCH") {
    return requireModule("dispatch")(req, res, next);
  }
  return next();
};

router.use(validarJWT);
router.use(resolveTenant);
router.use(loadTenantConfig);
router.use(resolveBranch);
router.use(resolveMembership);
router.use(requireScope());

router.get("/stage/:stageKey", requireModuleForStage, listOrdersByStage);
router.post("/stage/:stageKey/next", requireModuleForStage, claimNextStage);
router.post("/orders/:id/stage/:stageKey/claim", requireModuleForStage, claimStageByOrder);
router.post("/orders/:id/stage/:stageKey/start", requireModuleForStage, startStage);
router.post("/orders/:id/stage/:stageKey/complete", requireModuleForStage, completeStage);

module.exports = router;
