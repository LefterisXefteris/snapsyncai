import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { emptyGpsrParty, type GpsrIdentity } from "@/lib/product-facts";

export function GpsrIdentityFields({
  value,
  onChange,
}: {
  value: GpsrIdentity;
  onChange: (next: GpsrIdentity) => void;
}) {
  const manufacturer = value.manufacturer;
  const responsible = value.euResponsiblePerson ?? emptyGpsrParty();

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium">Manufacturer</p>
      <Input
        value={manufacturer.name}
        onChange={(e) =>
          onChange({ ...value, manufacturer: { ...manufacturer, name: e.target.value } })
        }
        placeholder="Name"
        className="h-8 text-xs"
      />
      <Textarea
        value={manufacturer.postalAddress}
        onChange={(e) =>
          onChange({
            ...value,
            manufacturer: { ...manufacturer, postalAddress: e.target.value },
          })
        }
        placeholder="Postal address"
        rows={2}
        className="text-xs"
      />
      <Input
        type="email"
        value={manufacturer.email}
        onChange={(e) =>
          onChange({ ...value, manufacturer: { ...manufacturer, email: e.target.value } })
        }
        placeholder="Email"
        className="h-8 text-xs"
      />
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={value.manufacturerInEu}
          onCheckedChange={(checked) =>
            onChange({ ...value, manufacturerInEu: checked === true })
          }
        />
        Manufacturer is in the EU
      </label>
      {!value.manufacturerInEu && (
        <>
          <p className="text-xs font-medium">EU responsible person</p>
          <Input
            value={responsible.name}
            onChange={(e) =>
              onChange({
                ...value,
                euResponsiblePerson: { ...responsible, name: e.target.value },
              })
            }
            placeholder="Name"
            className="h-8 text-xs"
          />
          <Textarea
            value={responsible.postalAddress}
            onChange={(e) =>
              onChange({
                ...value,
                euResponsiblePerson: { ...responsible, postalAddress: e.target.value },
              })
            }
            placeholder="Postal address"
            rows={2}
            className="text-xs"
          />
          <Input
            type="email"
            value={responsible.email}
            onChange={(e) =>
              onChange({
                ...value,
                euResponsiblePerson: { ...responsible, email: e.target.value },
              })
            }
            placeholder="Email"
            className="h-8 text-xs"
          />
        </>
      )}
    </div>
  );
}
