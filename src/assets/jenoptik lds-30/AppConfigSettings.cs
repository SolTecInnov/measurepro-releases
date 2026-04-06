using System;
using Newtonsoft.Json;

namespace RSA_Laser_Test_App
{
	// Token: 0x0200000B RID: 11
	public class AppConfigSettings
	{
		// Token: 0x17000012 RID: 18
		// (get) Token: 0x0600003F RID: 63 RVA: 0x00004BF4 File Offset: 0x00002DF4
		// (set) Token: 0x06000040 RID: 64 RVA: 0x00004BFC File Offset: 0x00002DFC
		[JsonProperty("DefaultLoggingMode")]
		public enLoggingMode enumDefaultLoggingMode { get; set; }

		// Token: 0x17000013 RID: 19
		// (get) Token: 0x06000041 RID: 65 RVA: 0x00004C05 File Offset: 0x00002E05
		// (set) Token: 0x06000042 RID: 66 RVA: 0x00004C0D File Offset: 0x00002E0D
		[JsonProperty("NotificationSound")]
		public enNotificationSound enumNotificationSound { get; set; }

		// Token: 0x17000014 RID: 20
		// (get) Token: 0x06000043 RID: 67 RVA: 0x00004C16 File Offset: 0x00002E16
		// (set) Token: 0x06000044 RID: 68 RVA: 0x00004C1E File Offset: 0x00002E1E
		[JsonProperty("UseTemperature")]
		public bool bUseTemperature { get; set; }

		// Token: 0x17000015 RID: 21
		// (get) Token: 0x06000045 RID: 69 RVA: 0x00004C27 File Offset: 0x00002E27
		// (set) Token: 0x06000046 RID: 70 RVA: 0x00004C2F File Offset: 0x00002E2F
		[JsonProperty("UseRouteSegment")]
		public bool bUseRouteSegment { get; set; }

		// Token: 0x17000016 RID: 22
		// (get) Token: 0x06000047 RID: 71 RVA: 0x00004C38 File Offset: 0x00002E38
		// (set) Token: 0x06000048 RID: 72 RVA: 0x00004C40 File Offset: 0x00002E40
		[JsonProperty("RequireGps")]
		public bool bRequireGps { get; set; } = true;
	}
}
