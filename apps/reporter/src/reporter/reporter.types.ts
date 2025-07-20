export type FunnelStageType = 'top' | 'bottom';

export interface EventStat {
  eventType: string;
  funnelStage: FunnelStageType;
  count: number;
}

export interface RevenueStat {
  facebook: number;
  tiktok: number;
  total: number;
}

export interface FacebookDemographics {
  byGender: Array<{
    gender: string;
    count: number;
    avgAge: number;
  }>;
  topCities: Array<{
    country: string;
    city: string;
    users: number;
  }>;
}

export interface TiktokDemographics {
  avgFollowers: number;
  byFollowersRange: Array<{
    range: string;
    count: number;
  }>;
}

export interface DemographicsStat {
  facebook?: FacebookDemographics;
  tiktok?: TiktokDemographics;
}
