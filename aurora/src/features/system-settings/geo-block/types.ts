/*
Geo-based model access restriction settings.
Mirrors backend setting/system_setting/geo_block.go.
*/

export type GeoBlockFamily = {
  key: string
  label: string
  prefixes: string[]
  blocked_countries: string[]
}

export type GeoBlockPageSettings = {
  'geo_block.enabled': boolean
  'geo_block.families': string
}
