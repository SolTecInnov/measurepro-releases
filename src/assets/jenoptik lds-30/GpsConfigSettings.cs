using System;
using Newtonsoft.Json;

namespace RSA_Laser_Test_App
{
	// Token: 0x0200000A RID: 10
	public class GpsConfigSettings
	{
		// Token: 0x1700000F RID: 15
		// (get) Token: 0x06000038 RID: 56 RVA: 0x00004BA7 File Offset: 0x00002DA7
		// (set) Token: 0x06000039 RID: 57 RVA: 0x00004BAF File Offset: 0x00002DAF
		[JsonProperty("PingEnabled")]
		public bool bPingEnabled { get; set; } = true;

		// Token: 0x17000010 RID: 16
		// (get) Token: 0x0600003A RID: 58 RVA: 0x00004BB8 File Offset: 0x00002DB8
		// (set) Token: 0x0600003B RID: 59 RVA: 0x00004BC0 File Offset: 0x00002DC0
		[JsonProperty("PingDistance_ft")]
		public int iPingDistance_ft { get; set; } = 528;

		// Token: 0x17000011 RID: 17
		// (get) Token: 0x0600003C RID: 60 RVA: 0x00004BC9 File Offset: 0x00002DC9
		// (set) Token: 0x0600003D RID: 61 RVA: 0x00004BD1 File Offset: 0x00002DD1
		[JsonProperty("GpsDataFormat")]
		public enGpsDataFormat enumGpsDataFormat { get; set; }
	}
}
