using System;
using Newtonsoft.Json;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000009 RID: 9
	public class HeightConfigSettings
	{
		// Token: 0x1700000C RID: 12
		// (get) Token: 0x06000031 RID: 49 RVA: 0x00004B4E File Offset: 0x00002D4E
		// (set) Token: 0x06000032 RID: 50 RVA: 0x00004B56 File Offset: 0x00002D56
		[JsonProperty("BaseHeight_m")]
		public double fBaseHeight_m { get; set; }

		// Token: 0x1700000D RID: 13
		// (get) Token: 0x06000033 RID: 51 RVA: 0x00004B5F File Offset: 0x00002D5F
		// (set) Token: 0x06000034 RID: 52 RVA: 0x00004B67 File Offset: 0x00002D67
		[JsonProperty("AlarmHeight_m")]
		public double fAlarmHeight_m { get; set; } = 24.0;

		// Token: 0x1700000E RID: 14
		// (get) Token: 0x06000035 RID: 53 RVA: 0x00004B70 File Offset: 0x00002D70
		// (set) Token: 0x06000036 RID: 54 RVA: 0x00004B78 File Offset: 0x00002D78
		[JsonProperty("MaxHeight_m")]
		public double fMaxHeight_m { get; set; } = 100.0;
	}
}
