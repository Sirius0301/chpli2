-- Life Folder L1: categories + documents, plus built-in seed taxonomy and
-- document templates (fixed ids; ON CONFLICT keeps the seed idempotent).

CREATE TABLE "lf_categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" VARCHAR(64) NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lf_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lf_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "notes" TEXT,
    "sensitive" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT,
    "storageKey" VARCHAR(512) NOT NULL,
    "fileName" VARCHAR(256) NOT NULL,
    "mimeType" VARCHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lf_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lf_documents_storageKey_key" ON "lf_documents"("storageKey");
CREATE INDEX "lf_documents_userId_categoryId_idx" ON "lf_documents"("userId", "categoryId");
ALTER TABLE "lf_categories" ADD CONSTRAINT "lf_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lf_categories" ADD CONSTRAINT "lf_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "lf_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lf_documents" ADD CONSTRAINT "lf_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lf_documents" ADD CONSTRAINT "lf_documents_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "lf_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "lf_templates" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lf_templates_pkey" PRIMARY KEY ("id")
);

-- Built-in categories (userId NULL = system-owned).
INSERT INTO "lf_categories" ("id", "userId", "name", "parentId", "sortOrder") VALUES
  ('lf-cat-identity', NULL, '身份与证件', NULL, 1),
  ('lf-cat-finance',  NULL, '财务与税务', NULL, 2),
  ('lf-cat-health',   NULL, '健康与医疗', NULL, 3),
  ('lf-cat-career',   NULL, '教育与职业', NULL, 4),
  ('lf-cat-property', NULL, '房产与车辆', NULL, 5),
  ('lf-cat-legal',    NULL, '家庭与法务', NULL, 6),
  ('lf-cat-other',    NULL, '其他',       NULL, 7)
ON CONFLICT ("id") DO NOTHING;

-- Built-in document templates.
INSERT INTO "lf_templates" ("id", "categoryId", "name", "description", "recommended") VALUES
  ('lf-tpl-idcard',    'lf-cat-identity', '身份证',       '本人及家庭成员身份证扫描件', true),
  ('lf-tpl-passport',  'lf-cat-identity', '护照',         '有效护照资料页', true),
  ('lf-tpl-bankcards', 'lf-cat-finance',  '银行卡清单',   '各银行账户与卡号清单', true),
  ('lf-tpl-insurance', 'lf-cat-finance',  '保险合同',     '重疾/医疗/寿险合同', false),
  ('lf-tpl-checkup',   'lf-cat-health',   '体检报告',     '最近一次全面体检报告', true),
  ('lf-tpl-vaccine',   'lf-cat-health',   '疫苗接种记录', '预防接种凭证', false),
  ('lf-tpl-degree',    'lf-cat-career',   '学历证书',     '毕业证/学位证', true),
  ('lf-tpl-contract',  'lf-cat-career',   '劳动合同',     '当前及重要历史合同', false),
  ('lf-tpl-property',  'lf-cat-property', '房产证',       '不动产权证书', true),
  ('lf-tpl-vehicle',   'lf-cat-property', '车辆登记证',   '机动车登记证书', false),
  ('lf-tpl-will',      'lf-cat-legal',    '遗嘱',         '遗嘱及公证文件', false),
  ('lf-tpl-emergency', 'lf-cat-other',    '紧急联系人卡', '紧急联系人与重要信息卡', true)
ON CONFLICT ("id") DO NOTHING;
