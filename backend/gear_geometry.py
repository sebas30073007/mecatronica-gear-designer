"""Involute spur gear profile generator — port of src/geometry/spurGear2D.ts."""
import math
from typing import List, Tuple

Point2D = Tuple[float, float]


def involute_point(rb: float, t: float) -> Point2D:
    return (
        rb * (math.cos(t) + t * math.sin(t)),
        rb * (math.sin(t) - t * math.cos(t)),
    )


def involute_param_for_radius(rb: float, r: float) -> float:
    if r <= rb:
        return 0.0
    return math.sqrt((r / rb) ** 2 - 1)


def involute_func(alpha: float) -> float:
    return math.tan(alpha) - alpha


def involute_flank_points(base_r: float, start_r: float, end_r: float, steps: int) -> List[Point2D]:
    t0 = involute_param_for_radius(base_r, max(base_r, start_r))
    t1 = involute_param_for_radius(base_r, end_r)
    return [involute_point(base_r, t0 + (t1 - t0) * i / steps) for i in range(steps + 1)]


def rotate_point(p: Point2D, angle: float) -> Point2D:
    c, s = math.cos(angle), math.sin(angle)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c)


def mirror_y(p: Point2D) -> Point2D:
    return (p[0], -p[1])


def polar_to_cartesian(r: float, angle: float) -> Point2D:
    return (r * math.cos(angle), r * math.sin(angle))


def arc_points(r: float, start_angle: float, end_angle: float, steps: int) -> List[Point2D]:
    return [
        polar_to_cartesian(r, start_angle + (end_angle - start_angle) * i / steps)
        for i in range(1, steps + 1)
    ]


def spur_gear_outline(
    teeth: int,
    module_mm: float,
    pressure_angle_deg: float = 20.0,
    backlash_mm: float = 0.0,
    quality: int = 14,
) -> List[Point2D]:
    """Returns a closed CCW polygon of the gear outline in mm (Y-up math coords)."""
    pa      = math.radians(pressure_angle_deg)
    pitch_r = module_mm * teeth / 2
    outer_r = pitch_r + module_mm
    root_r  = pitch_r - 1.25 * module_mm
    base_r  = pitch_r * math.cos(pa)

    pitch_angle         = 2 * math.pi / teeth
    half_angle_at_pitch = (math.pi * module_mm / 2 - backlash_mm) / (2 * pitch_r)
    flank_phase         = -(half_angle_at_pitch + involute_func(pa))

    start_r   = max(base_r, root_r)
    raw_flank = involute_flank_points(base_r, start_r, outer_r, quality)

    right_flank = [rotate_point(p, flank_phase) for p in raw_flank]
    left_flank  = [mirror_y(p) for p in reversed(right_flank)]

    right_root_angle = math.atan2(right_flank[0][1],  right_flank[0][0])
    left_root_angle  = math.atan2(left_flank[-1][1],  left_flank[-1][0])

    all_pts: List[Point2D] = []
    for i in range(teeth):
        theta = i * pitch_angle

        if base_r > root_r:
            all_pts.append(rotate_point(polar_to_cartesian(root_r, right_root_angle), theta))

        for p in right_flank:
            all_pts.append(rotate_point(p, theta))
        for p in left_flank:
            all_pts.append(rotate_point(p, theta))

        if base_r > root_r:
            all_pts.append(rotate_point(polar_to_cartesian(root_r, left_root_angle), theta))

        arc_start = theta + left_root_angle
        arc_end   = (i + 1) * pitch_angle + right_root_angle
        if arc_end <= arc_start + 1e-9:
            arc_end += 2 * math.pi

        all_pts.extend(arc_points(root_r, arc_start, arc_end, 3))

    return all_pts


def rack_profile_2d(
    n_teeth: int,
    module_mm: float,
    pressure_angle_deg: float = 20.0,
    body_height_mm: float = 0.0,
) -> List[Point2D]:
    """2D cross-section of a rack (XY plane), teeth pointing +Y.
    Origin at pitch-line centre. Polygon is CW so the extruded face is correct.
    """
    pa       = math.radians(pressure_angle_deg)
    pitch    = math.pi * module_mm
    addendum = module_mm
    dedendum = 1.25 * module_mm
    if body_height_mm <= 0:
        body_height_mm = 2.0 * module_mm

    half_len = n_teeth * pitch / 2
    tan_pa   = math.tan(pa)

    pts: List[Point2D] = []
    pts.append((-half_len, -(dedendum + body_height_mm)))
    pts.append(( half_len, -(dedendum + body_height_mm)))
    pts.append(( half_len, -dedendum))

    for i in range(n_teeth - 1, -1, -1):
        xc  = (i + 0.5 - n_teeth / 2) * pitch
        x_rr = xc + pitch / 4 + dedendum * tan_pa
        x_rt = xc + pitch / 4 - addendum * tan_pa
        x_lt = xc - pitch / 4 + addendum * tan_pa
        x_lr = xc - pitch / 4 - dedendum * tan_pa
        pts.append((x_rr, -dedendum))
        pts.append((x_rt,  addendum))
        pts.append((x_lt,  addendum))
        pts.append((x_lr, -dedendum))

    pts.append((-half_len, -dedendum))
    return pts
