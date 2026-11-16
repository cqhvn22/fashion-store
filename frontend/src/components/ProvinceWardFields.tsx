import divisions from '../data/vietnamDivisions.json';

type Props = {
  province: string;
  ward: string;
  onProvinceChange: (value: string) => void;
  onWardChange: (value: string) => void;
  provinceError?: string;
  wardError?: string;
};

export function ProvinceWardFields({ province, ward, onProvinceChange, onWardChange,
  provinceError, wardError }: Props) {
  const selected = divisions.find((item) => item.name === province);
  return (
    <>
      <label className="form-label">
        Tỉnh / Thành phố
        <select required className="field" value={province} onChange={(event) => onProvinceChange(event.target.value)}>
          <option value="">Chọn tỉnh / thành phố</option>
          {province && !selected && <option value={province} disabled>{province} (địa chỉ cũ)</option>}
          {divisions.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
        </select>
        {provinceError && <span className="field-error">{provinceError}</span>}
      </label>
      <label className="form-label">
        Phường / Xã / Đặc khu
        <select required className="field" value={ward} disabled={!selected}
          onChange={(event) => onWardChange(event.target.value)}>
          <option value="">Chọn phường / xã</option>
          {ward && selected && !selected.wards.some((item) => item.name === ward)
            && <option value={ward} disabled>{ward} (địa chỉ cũ)</option>}
          {selected?.wards.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
        </select>
        {wardError && <span className="field-error">{wardError}</span>}
      </label>
    </>
  );
}

export function isValidDivision(province: string, ward: string): boolean {
  return divisions.some((item) => item.name === province
    && item.wards.some((child) => child.name === ward));
}
