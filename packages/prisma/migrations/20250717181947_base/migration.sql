/*
  Warnings:

  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('top', 'bottom');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'non_binary');

-- CreateEnum
CREATE TYPE "FacebookReferrer" AS ENUM ('newsfeed', 'marketplace', 'groups');

-- CreateEnum
CREATE TYPE "ClickPosition" AS ENUM ('top_left', 'bottom_right', 'center');

-- CreateEnum
CREATE TYPE "Device" AS ENUM ('mobile', 'desktop');

-- CreateEnum
CREATE TYPE "Browser" AS ENUM ('Chrome', 'Firefox', 'Safari');

-- CreateEnum
CREATE TYPE "TiktokDevice" AS ENUM ('Android', 'iOS', 'Desktop');

-- DropTable
DROP TABLE "Event";

-- CreateTable
CREATE TABLE "FacebookUserLocation" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,

    CONSTRAINT "FacebookUserLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "FacebookUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookEngagementTop" (
    "id" TEXT NOT NULL,
    "actionTime" TIMESTAMP(3) NOT NULL,
    "referrer" "FacebookReferrer" NOT NULL,
    "videoId" TEXT,

    CONSTRAINT "FacebookEngagementTop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookEngagementBottom" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clickPosition" "ClickPosition" NOT NULL,
    "device" "Device" NOT NULL,
    "browser" "Browser" NOT NULL,
    "purchaseAmount" DECIMAL(65,30),

    CONSTRAINT "FacebookEngagementBottom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "funnelStage" "FunnelStage" NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "engagementTopId" TEXT,
    "engagementBottomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiktokUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "followers" INTEGER NOT NULL,

    CONSTRAINT "TiktokUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiktokEngagementTop" (
    "id" TEXT NOT NULL,
    "watchTime" INTEGER NOT NULL,
    "percentageWatched" INTEGER NOT NULL,
    "device" "TiktokDevice" NOT NULL,
    "country" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,

    CONSTRAINT "TiktokEngagementTop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiktokEngagementBottom" (
    "id" TEXT NOT NULL,
    "actionTime" TIMESTAMP(3) NOT NULL,
    "profileId" TEXT,
    "purchasedItem" TEXT,
    "purchaseAmount" DECIMAL(65,30),

    CONSTRAINT "TiktokEngagementBottom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiktokEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "funnelStage" "FunnelStage" NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "engagementTopId" TEXT,
    "engagementBottomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TiktokEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacebookUserLocation_country_city_key" ON "FacebookUserLocation"("country", "city");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookUser_userId_key" ON "FacebookUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookEvent_eventId_key" ON "FacebookEvent"("eventId");

-- CreateIndex
CREATE INDEX "FacebookEvent_timestamp_idx" ON "FacebookEvent"("timestamp");

-- CreateIndex
CREATE INDEX "FacebookEvent_eventType_idx" ON "FacebookEvent"("eventType");

-- CreateIndex
CREATE INDEX "FacebookEvent_funnelStage_idx" ON "FacebookEvent"("funnelStage");

-- CreateIndex
CREATE UNIQUE INDEX "TiktokUser_userId_key" ON "TiktokUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TiktokEvent_eventId_key" ON "TiktokEvent"("eventId");

-- CreateIndex
CREATE INDEX "TiktokEvent_timestamp_idx" ON "TiktokEvent"("timestamp");

-- CreateIndex
CREATE INDEX "TiktokEvent_eventType_idx" ON "TiktokEvent"("eventType");

-- CreateIndex
CREATE INDEX "TiktokEvent_funnelStage_idx" ON "TiktokEvent"("funnelStage");

-- AddForeignKey
ALTER TABLE "FacebookUser" ADD CONSTRAINT "FacebookUser_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "FacebookUserLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookEvent" ADD CONSTRAINT "FacebookEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FacebookUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookEvent" ADD CONSTRAINT "FacebookEvent_engagementTopId_fkey" FOREIGN KEY ("engagementTopId") REFERENCES "FacebookEngagementTop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookEvent" ADD CONSTRAINT "FacebookEvent_engagementBottomId_fkey" FOREIGN KEY ("engagementBottomId") REFERENCES "FacebookEngagementBottom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiktokEvent" ADD CONSTRAINT "TiktokEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TiktokUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiktokEvent" ADD CONSTRAINT "TiktokEvent_engagementTopId_fkey" FOREIGN KEY ("engagementTopId") REFERENCES "TiktokEngagementTop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiktokEvent" ADD CONSTRAINT "TiktokEvent_engagementBottomId_fkey" FOREIGN KEY ("engagementBottomId") REFERENCES "TiktokEngagementBottom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
