const DEFAULT_PIPELINE = [
  { name: 'New', isDefault: true },
  { name: 'Contacted', isDefault: false },
  { name: 'Qualified', isDefault: false },
  { name: 'Converted', isDefault: false },
  { name: 'Closed', isDefault: false },
];

function slugifyClientCode(companyName) {
  const base = String(companyName || 'client')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'client';
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}

async function seedDefaultPipeline(tenantId, PipelineStage) {
  await PipelineStage.bulkCreate(
    DEFAULT_PIPELINE.map((stage, index) => ({
      tenantId,
      name: stage.name,
      sortOrder: index,
      isDefault: stage.isDefault,
    })),
  );
}

export {
  DEFAULT_PIPELINE,
  slugifyClientCode,
  seedDefaultPipeline,
};
