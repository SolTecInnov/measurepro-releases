using System;
using Newtonsoft.Json;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000008 RID: 8
	public class LaserDataConfigSettings
	{
		// Token: 0x1700000A RID: 10
		// (get) Token: 0x0600002C RID: 44 RVA: 0x00004B1D File Offset: 0x00002D1D
		// (set) Token: 0x0600002D RID: 45 RVA: 0x00004B25 File Offset: 0x00002D25
		[JsonProperty("IntensityThreshold")]
		public int iIntensityThreshold { get; set; } = 6;

		// Token: 0x1700000B RID: 11
		// (get) Token: 0x0600002E RID: 46 RVA: 0x00004B2E File Offset: 0x00002D2E
		// (set) Token: 0x0600002F RID: 47 RVA: 0x00004B36 File Offset: 0x00002D36
		[JsonProperty("DistanceThreshold_m")]
		public double fDistanceThreshold_m { get; set; }
	}
}
