import unittest
from _import_vn import eligible


class EligibilityTests(unittest.TestCase):
    def test_status_and_dates(self):
        good = dict(isActive=True, isHetHan=False)
        self.assertTrue(eligible(good, '2026-09-23'))
        for field, value in [('isDaRutSoDangKy', True), ('isHetHan', True), ('isDeleted', True), ('isActive', False), ('isHetHan', None)]:
            with self.subTest(field=field):
                self.assertFalse(eligible(dict(good, **{field: value}), '2026-09-23'))
        for expiry, expected in [('2026-09-22', False), ('2026-09-23', True), ('2027-01-01', True)]:
            self.assertEqual(eligible(dict(good, thongTinDangKyThuoc={'ngayHetHanSoDangKy': expiry}), '2026-09-23'), expected)


if __name__ == '__main__':
    unittest.main()
