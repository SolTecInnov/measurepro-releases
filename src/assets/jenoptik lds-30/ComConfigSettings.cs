using System;
using Newtonsoft.Json;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000007 RID: 7
	public class ComConfigSettings
	{
		// Token: 0x17000006 RID: 6
		// (get) Token: 0x06000023 RID: 35 RVA: 0x00004AA5 File Offset: 0x00002CA5
		// (set) Token: 0x06000024 RID: 36 RVA: 0x00004AAD File Offset: 0x00002CAD
		[JsonProperty("LaserPortName")]
		public string sLaserPortName { get; set; } = "COM1";

		// Token: 0x17000007 RID: 7
		// (get) Token: 0x06000025 RID: 37 RVA: 0x00004AB6 File Offset: 0x00002CB6
		// (set) Token: 0x06000026 RID: 38 RVA: 0x00004ABE File Offset: 0x00002CBE
		[JsonProperty("LaserBaudRate")]
		public enLaserBaudRate enumLaserBaudRate { get; set; } = enLaserBaudRate.b460800;

		// Token: 0x17000008 RID: 8
		// (get) Token: 0x06000027 RID: 39 RVA: 0x00004AC7 File Offset: 0x00002CC7
		// (set) Token: 0x06000028 RID: 40 RVA: 0x00004ACF File Offset: 0x00002CCF
		[JsonProperty("GpsPortName")]
		public string sGpsPortName { get; set; } = "COM2";

		// Token: 0x17000009 RID: 9
		// (get) Token: 0x06000029 RID: 41 RVA: 0x00004AD8 File Offset: 0x00002CD8
		// (set) Token: 0x0600002A RID: 42 RVA: 0x00004AE0 File Offset: 0x00002CE0
		[JsonProperty("GpsBaudRate")]
		public enGpsBaudRate enumGpsBaudRate { get; set; } = enGpsBaudRate.b4800;
	}
}
